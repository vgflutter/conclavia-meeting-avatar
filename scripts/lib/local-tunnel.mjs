import { randomUUID } from "node:crypto";
import { lstat, open, readFile, rename, unlink } from "node:fs/promises";
import { createServer } from "node:net";
import { parseEnv } from "node:util";

export const LOCAL_ORIGIN = "http://127.0.0.1:3000";
export const ENV_KEY = "CONCLAVIA_PUBLIC_URL";

export function quickOrigin(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      !url.search && !url.hash && url.pathname === "/" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/u.test(url.hostname)
      ? url.origin : undefined;
  } catch { return undefined; }
}

function publicSetting(source) {
  const matches = [...source.matchAll(/^([\t ]*(?:export[\t ]+)?CONCLAVIA_PUBLIC_URL[\t ]*=[\t ]*)([^\r\n]*)/gm)];
  if (matches.length > 1) throw new Error("CONCLAVIA_PUBLIC_URL compare più volte: correggi la duplicazione in .env.local.");
  const match = matches[0];
  if (!match) return undefined;
  // Edit one single-line public setting only. Never interpret or print other values.
  const rhs = /^(["'])(.*?)\1([\t ]*(?:#.*)?)$|^([^"'#\s]*)([\t ]*(?:#.*)?)$/u.exec(match[2]);
  if (!rhs) throw new Error("CONCLAVIA_PUBLIC_URL deve essere un indirizzo su una sola riga.");
  if (parseEnv(source)[ENV_KEY] !== (rhs[2] ?? rhs[4])) throw new Error("La riga dell'indirizzo pubblico è ambigua. Non modifico .env.local.");
  return { match, value: rhs[2] ?? rhs[4], quote: rhs[1] || "", suffix: rhs[3] ?? rhs[5] };
}

export function readPublicOrigin(source) { return publicSetting(source)?.value; }

export function replacePublicOrigin(source, origin) {
  if (quickOrigin(origin) !== origin) throw new Error("Il nuovo indirizzo non è un'origine Cloudflare Quick Tunnel valida.");
  const setting = publicSetting(source);
  if (!setting) {
    const eol = source.includes("\r\n") ? "\r\n" : "\n";
    return source + (source && !source.endsWith("\n") ? eol : "") + `${ENV_KEY}=${origin}${eol}`;
  }
  const { match, quote, suffix } = setting;
  return source.slice(0, match.index) + match[1] + quote + origin + quote + suffix +
    source.slice(match.index + match[0].length);
}

export async function readEnvironment(file) {
  const stat = await lstat(file).catch(() => undefined);
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error("Serve il file .env.local originale, non un link simbolico. Non è stato creato o sostituito.");
  return { source: await readFile(file, "utf8"), mode: stat.mode & 0o777 };
}

export async function writeEnvironment(file, expected, replacement) {
  const current = await readEnvironment(file);
  if (current.source !== expected) throw new Error(".env.local è cambiato durante il controllo. Riprova: nessuna impostazione è stata sovrascritta.");
  const temporary = `${file}.tunnel-${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", current.mode);
  try {
    await handle.chmod(current.mode);
    await handle.writeFile(replacement, "utf8");
    await handle.sync();
    await handle.close();
    if ((await readEnvironment(file)).source !== expected) throw new Error(".env.local modificato nel frattempo: aggiornamento annullato.");
    await rename(temporary, file);
  } finally {
    await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

// A loopback-only lock, automatically released by the OS even after a crash.
// Unlike a PID file, stale PIDs/files cannot block recovery after a restart.
export async function acquireRecoveryLock(port = 39091) {
  const server = createServer(socket => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once("error", () => reject(new Error("Un altro launcher tunnel è attivo, oppure la porta locale 39091 è occupata. Non avvio un duplicato; usa npm run tunnel:check.")));
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}

export async function checkConnection(origin, request = fetch) {
  if (!quickOrigin(origin)) return { ok: false, reason: "Indirizzo Quick Tunnel assente o non valido." };
  try {
    const health = await request(`${origin}/api/health`, { redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!health.ok || (await health.json()).status !== "ok") return { ok: false, reason: "L'app o il database non rispondono correttamente." };
    // No private meeting links, provider calls, speech generation or mutations.
    for (const [path, method] of [["/meetings", "GET"], ["/api/meetings", "GET"], ["/api/avatar", "GET"], ["/api/avatar/speech", "POST"]]) {
      const response = await request(origin + path, { method, redirect: "error", signal: AbortSignal.timeout(8000) });
      await response.body?.cancel();
      if (response.status !== 404) return { ok: false, unsafe: true, reason: "Le pagine di gestione non risultano protette. Tunnel non pronto." };
    }
    return { ok: true };
  } catch { return { ok: false, reason: "Indirizzo pubblico non raggiungibile (DNS, rete o tunnel interrotto)." }; }
}

// The workflow is dependency-injected so recovery/failure paths can be tested
// without touching the user's environment, processes, database or Cloudflare.
export async function restoreTunnel(io, { checkOnly = false } = {}) {
  const original = await io.readEnvironment();
  const configured = readPublicOrigin(original);
  if (configured && !quickOrigin(configured)) throw new Error("È configurato un dominio personalizzato. Questo comando gestisce solo i tunnel temporanei trycloudflare.com e non lo sostituisce.");
  const app = await io.inspectApp(); // Refuse a foreign process before exposing a port.
  const localReady = Boolean(app) && await io.localHealthy();
  const existing = localReady && configured ? await io.checkConnection(configured) : { ok: false, reason: "App o tunnel non attivi." };
  if (existing.unsafe) throw new Error(existing.reason);
  if (existing.ok) {
    io.log("Tunnel già funzionante. Non ho cambiato indirizzo né riavviato processi.");
    io.ready(configured, false);
    return;
  }
  if (checkOnly) throw new Error(`${existing.reason} Per ripristinare: npm run tunnel`);

  await io.requireConnector();
  let updated;
  try {
    io.log("Creo il collegamento HTTPS temporaneo…");
    const origin = await io.startTunnel();
    updated = replacePublicOrigin(original, origin);
    await io.writeEnvironment(original, updated);
    io.log("Aggiornato solo CONCLAVIA_PUBLIC_URL in .env.local.");
    if (app) {
      io.log("Riavvio il server di questo progetto per caricare il nuovo indirizzo…");
      await io.stopApp(app);
    }
    await io.startApp(origin);
    await io.waitLocal();
    await io.waitPublic(origin);
    io.ready(origin, true);
    await io.supervise(origin);
  } catch (error) {
    // Roll back only our own change, never a simultaneous user edit.
    if (updated && await io.readEnvironment() === updated) {
      await io.writeEnvironment(updated, original);
      io.log("Ripristinata la configurazione precedente dopo il mancato avvio.");
    }
    throw error;
  } finally {
    await io.cleanup(); // Only children created by this invocation.
  }
}
