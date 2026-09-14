#!/usr/bin/env node
import { spawn, execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, realpath } from "node:fs/promises";
import { dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { LOCAL_ORIGIN, acquireRecoveryLock, checkConnection, quickOrigin, readEnvironment, restoreTunnel, writeEnvironment } from "./lib/local-tunnel.mjs";
import { captureDiagnosticStream, createLocalDiagnosticLog } from "./lib/local-diagnostic-log.mjs";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("npm run tunnel        Ripristina app e tunnel per la prova Teams.\nnpm run tunnel:check  Controlla senza modificare nulla.\nSe viene avviato un tunnel, lascia questo terminale aperto; Ctrl+C ferma i processi avviati qui.");
  process.exit(0);
}
if (args.some(arg => arg !== "--check")) {
  console.error("Opzione non riconosciuta. Usa npm run tunnel -- --help.");
  process.exit(1);
}

const root = await realpath(join(dirname(fileURLToPath(import.meta.url)), ".."));
const envFile = join(root, ".env.local");
const run = promisify(execFile);
const children = [];
let connector;
let stopping = false;
let lock;
let diagnostics;
const log = message => console.log(`[Conclavia] ${message}`);
const tool = async (binary, argv) => (await run(binary, argv, { timeout: 10000, maxBuffer: 128 * 1024 })).stdout.trim();

async function processInfo(pid) {
  const cwd = (await tool("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"])).split("\n").find(line => line.startsWith("n"))?.slice(1);
  return { pid, cwd: cwd ? await realpath(cwd) : "", command: await tool("ps", ["-p", String(pid), "-o", "command="]),
    started: await tool("ps", ["-p", String(pid), "-o", "lstart="]) };
}

async function inspectApp() {
  let result;
  try { result = await tool("lsof", ["-nP", "-t", "-iTCP:3000", "-sTCP:LISTEN"]); }
  catch (error) {
    if (error.code === 1) return undefined;
    throw new Error("Impossibile controllare la porta 3000. Servono lsof e ps (macOS/Linux).");
  }
  const pids = [...new Set(result.split(/\s+/u).filter(Boolean).map(Number))];
  if (pids.length !== 1 || !Number.isInteger(pids[0])) throw new Error("La porta 3000 non ha un proprietario univoco: nessun processo è stato fermato.");
  const server = await processInfo(pids[0]);
  const parentPid = Number(await tool("ps", ["-p", String(server.pid), "-o", "ppid="]));
  const parent = await processInfo(parentPid);
  const knownCLI = [join(root, "node_modules/next/dist/bin/next"), join(root, "node_modules/.bin/next")].some(path => parent.command.includes(path));
  if (server.cwd !== root || parent.cwd !== root || !/^next-server\b/u.test(server.command) || !knownCLI || !/\bdev\b/u.test(parent.command)) {
    throw new Error("La porta 3000 è occupata da un processo non riconosciuto come Next dev di questo progetto. Non lo fermo e non apro il tunnel.");
  }
  return { server, parent };
}

async function localHealthy() {
  try {
    const response = await fetch(`${LOCAL_ORIGIN}/api/health`, { redirect: "error", signal: AbortSignal.timeout(5000) });
    return response.ok && (await response.json()).status === "ok";
  } catch { return false; }
}

function startChild(binary, argv, options = {}) {
  const child = spawn(binary, argv, { cwd: root, stdio: ["ignore", "pipe", "pipe"], ...options });
  child.on("error", () => { child.failed = true; });
  // Capture bounded/redacted records, never echo raw subprocess output.
  const source = binary === connector ? "cloudflared" : "app";
  captureDiagnosticStream(child.stdout, `${source}:stdout`, diagnostics);
  captureDiagnosticStream(child.stderr, `${source}:stderr`, diagnostics);
  children.push(child);
  return child;
}

async function waitFor(check, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (!stopping && Date.now() < deadline) {
    if (children.some(child => child.failed || child.exitCode !== null || child.signalCode !== null)) throw new Error("Uno dei processi avviati si è fermato. Controlla installazione e configurazione, poi rilancia npm run tunnel.");
    if (await check()) return;
    await delay(1000);
  }
  throw new Error(stopping ? "Avvio interrotto." : message);
}

async function cleanup() {
  for (const child of [...children].reverse()) {
    if (child.exitCode !== null || child.signalCode !== null || !child.pid) continue;
    child.kill("SIGTERM");
    const deadline = Date.now() + 10000;
    while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) await delay(100);
    if (child.exitCode === null && child.signalCode === null) log("Un processo non ha confermato la chiusura. Non viene terminato forzatamente; controllalo prima di rilanciare.");
  }
}

try {
  if (!["darwin", "linux"].includes(process.platform)) throw new Error("Questo launcher supporta macOS/Linux. Per altri sistemi usa la procedura manuale nel README.");
  await import("./system-ca.mjs");
  if (!args.includes("--check")) {
    lock = await acquireRecoveryLock();
    diagnostics = await createLocalDiagnosticLog(join(root, ".conclavia", "logs"), {
      onError: () => log("ATTENZIONE: salvataggio diagnostico locale interrotto. Nessun output privato viene stampato."),
    });
  }
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });
  await restoreTunnel({
    readEnvironment: async () => (await readEnvironment(envFile)).source,
    writeEnvironment: (before, after) => writeEnvironment(envFile, before, after),
    inspectApp, localHealthy, checkConnection, log,
    requireConnector: async () => {
      for (const directory of [...(process.env.PATH || "").split(delimiter), "/opt/homebrew/bin", "/usr/local/bin"]) {
        if (!directory) continue;
        const candidate = join(directory, "cloudflared");
        try { await access(candidate, constants.X_OK); connector = candidate; break; } catch { /* try next */ }
      }
      if (!connector) throw new Error("cloudflared non è installato. Su Mac: brew install cloudflared. Poi rilancia npm run tunnel.");
      await access(join(root, "node_modules/next/dist/bin/next"));
    },
    startTunnel: async () => {
      // Recheck ownership immediately before exposing the local port.
      await inspectApp();
      const child = startChild(connector, ["tunnel", "--url", LOCAL_ORIGIN, "--no-autoupdate"]);
      let buffer = "", origin;
      const collect = chunk => {
        buffer = (buffer + chunk.toString()).slice(-16384);
        const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gu)?.at(-1);
        if (match) origin = quickOrigin(match);
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);
      await waitFor(() => Boolean(origin), 45000, "Cloudflare non ha fornito un indirizzo entro 45 secondi. Verifica rete/VPN e riprova.");
      return origin;
    },
    stopApp: async expected => {
      const current = await inspectApp();
      if (!current) return;
      if (current.parent.pid !== expected.parent.pid || current.parent.started !== expected.parent.started || current.server.pid !== expected.server.pid) {
        throw new Error("Il processo sulla porta 3000 è cambiato: riavvio annullato per sicurezza.");
      }
      process.kill(current.parent.pid, "SIGTERM");
      await waitFor(async () => {
        try { await tool("lsof", ["-nP", "-t", "-iTCP:3000", "-sTCP:LISTEN"]); return false; }
        catch (error) { if (error.code === 1) return true; throw error; }
      }, 15000, "Il vecchio server non ha liberato la porta 3000. Non ne avvio un secondo.");
    },
    startApp: async origin => {
      if (await inspectApp()) throw new Error("La porta 3000 è stata occupata nel frattempo. Non avvio un duplicato.");
      const childEnv = { ...process.env, CONCLAVIA_PUBLIC_URL: origin };
      delete childEnv.NODE_ENV;
      startChild(process.execPath, [join(root, "scripts/dev-with-system-ca.mjs"), "--port", "3000"], { env: childEnv });
      log("Avvio Conclavia sulla porta 3000…");
    },
    waitLocal: () => waitFor(localHealthy, 90000, "L'app o MongoDB non sono pronti. Avvia npm run dev:system-ca per vedere la diagnostica locale."),
    waitPublic: origin => waitFor(async () => {
      const result = await checkConnection(origin);
      if (result.unsafe) throw new Error(result.reason);
      return result.ok;
    }, 60000, "Il nuovo tunnel non è raggiungibile entro il tempo previsto. Controlla la rete e riprova."),
    ready: (origin, owned) => {
      log(`PRONTO — GUI: http://localhost:3000/meetings\n  Collegamento pubblico: ${origin}`);
      log("Health pubblico OK; pagine/API di gestione bloccate. Nessun bot inviato e nessun audio generato.");
      log("Il controllo completo dell'avatar viene eseguito dall'app prima di inviarlo. Audio/video Teams vanno verificati dopo l'ammissione.");
      log(owned ? "Lascia questo terminale aperto e il Mac sveglio. Ctrl+C ferma app e tunnel avviati qui." : "App e tunnel esistenti restano nei loro terminali: tienili aperti e il Mac sveglio.");
      if (owned) log("Log locali ripuliti: .conclavia/logs/runtime.log (rotazione a 1 MiB, una copia precedente).");
      log("Se l'indirizzo è cambiato, un vecchio bot conserva il vecchio link: attendi l'uscita confermata prima di un nuovo tentativo dalla GUI.");
    },
    supervise: async origin => {
      let nextCheck = Date.now() + 30000;
      while (!stopping) {
        if (children.some(child => child.failed || child.exitCode !== null || child.signalCode !== null)) throw new Error("App o tunnel si sono fermati. Rilancia npm run tunnel; non sono stati creati bot sostitutivi.");
        if (Date.now() >= nextCheck) {
          const result = await checkConnection(origin);
          if (result.unsafe) throw new Error(result.reason);
          if (!result.ok) log("ATTENZIONE: collegamento interrotto. Se non torna disponibile, premi Ctrl+C e rilancia npm run tunnel.");
          nextCheck = Date.now() + 30000;
        }
        await delay(500);
      }
      log("Chiusura dei processi avviati da questo comando. I bot Teams non vengono fatti uscire automaticamente.");
    },
    cleanup,
  }, { checkOnly: args.includes("--check") });
} catch (error) {
  // Never echo subprocess output, environment contents or capability URLs.
  console.error(`[Conclavia] ${error.code ? "Operazione locale non riuscita. Controlla permessi e dipendenze; nessuna credenziale viene mostrata." : error.message}`);
  process.exitCode = stopping ? 130 : 1;
} finally {
  await diagnostics?.close();
  if (lock) await new Promise(resolve => lock.close(resolve));
}
