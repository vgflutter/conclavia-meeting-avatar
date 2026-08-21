import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CheckLevel = "ready" | "warning" | "missing";

export interface PreflightCheck {
  id: string;
  label: string;
  level: CheckLevel;
  detail: string;
  action?: string;
}

export interface PreflightReport {
  platform: NodeJS.Platform;
  generatedAt: string;
  readyForProtocolTest: boolean;
  readyForTeamsLoop: boolean;
  checks: PreflightCheck[];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function commandOutput(command: string, args: string[]): Promise<string> {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8",
      maxBuffer: 2_000_000,
    });
    return `${result.stdout}\n${result.stderr}`;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null) {
      const record = error as { stdout?: string; stderr?: string };
      return `${record.stdout ?? ""}\n${record.stderr ?? ""}`;
    }
    return "";
  }
}

async function inspectFfmpeg(): Promise<PreflightCheck> {
  const output = await commandOutput("ffmpeg", ["-version"]);
  const firstLine = output.split("\n").find(Boolean);

  if (!firstLine?.startsWith("ffmpeg version")) {
    return {
      id: "ffmpeg",
      label: "ffmpeg",
      level: "missing",
      detail: "Non trovato nel PATH.",
      action: "Installa ffmpeg con Homebrew: brew install ffmpeg",
    };
  }

  return {
    id: "ffmpeg",
    label: "ffmpeg",
    level: "ready",
    detail: firstLine,
  };
}

async function inspectObs(): Promise<PreflightCheck> {
  const candidates = [
    "/Applications/OBS.app",
    `${homedir()}/Applications/OBS.app`,
  ];
  const found = (await Promise.all(candidates.map(pathExists))).some(Boolean);

  return found
    ? {
        id: "obs",
        label: "OBS Studio",
        level: "ready",
        detail: "Applicazione trovata. La Virtual Camera potrà essere usata nel meeting.",
      }
    : {
        id: "obs",
        label: "OBS Studio",
        level: "missing",
        detail: "Applicazione non trovata.",
        action: "Installa OBS Studio e avvia almeno una volta la Virtual Camera.",
      };
}

async function inspectAudioRouting(): Promise<PreflightCheck> {
  const output = await commandOutput("system_profiler", ["SPAudioDataType"]);
  const virtualDevices = output
    .split("\n")
    .map((line) => line.trim().replace(/:$/, ""))
    .filter((line) => /blackhole|loopback|soundflower/i.test(line));
  const uniqueDevices = [...new Set(virtualDevices)];

  if (uniqueDevices.length === 0) {
    return {
      id: "audio-routing",
      label: "Audio virtuale",
      level: "missing",
      detail: "Nessun dispositivo virtuale rilevato.",
      action: "Installa BlackHole 2ch e 16ch, oppure Loopback.",
    };
  }

  if (uniqueDevices.length === 1) {
    return {
      id: "audio-routing",
      label: "Audio virtuale",
      level: "warning",
      detail: `Rilevato ${uniqueDevices[0]}. Per un test full-duplex senza eco servono due percorsi distinti.`,
      action: "Aggiungi un secondo dispositivo BlackHole oppure usa Loopback.",
    };
  }

  return {
    id: "audio-routing",
    label: "Audio virtuale",
    level: "ready",
    detail: `Rilevati: ${uniqueDevices.join(", ")}.`,
  };
}

export async function runMacosPreflight(): Promise<PreflightReport> {
  if (process.platform !== "darwin") {
    return {
      platform: process.platform,
      generatedAt: new Date().toISOString(),
      readyForProtocolTest: true,
      readyForTeamsLoop: false,
      checks: [
        {
          id: "platform",
          label: "Sistema operativo",
          level: "warning",
          detail: "Il preflight audio completo è attualmente progettato per macOS.",
        },
      ],
    };
  }

  const checks = await Promise.all([
    inspectFfmpeg(),
    inspectObs(),
    inspectAudioRouting(),
  ]);

  return {
    platform: process.platform,
    generatedAt: new Date().toISOString(),
    readyForProtocolTest: true,
    readyForTeamsLoop: checks.every((check) => check.level === "ready"),
    checks,
  };
}
