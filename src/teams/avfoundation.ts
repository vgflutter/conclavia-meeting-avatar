import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface AvfoundationAudioDevice {
  index: number;
  name: string;
}

export function parseAvfoundationAudioDevices(output: string): AvfoundationAudioDevice[] {
  const devices: AvfoundationAudioDevice[] = [];
  let inAudioSection = false;

  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (line.includes("AVFoundation audio devices:")) {
      inAudioSection = true;
      continue;
    }
    if (!inAudioSection) continue;
    if (line.includes("AVFoundation video devices:")) {
      inAudioSection = false;
      continue;
    }

    const match = /\[(\d+)\]\s+(.+)$/.exec(line);
    if (!match?.[1] || !match[2]) continue;
    devices.push({ index: Number.parseInt(match[1], 10), name: match[2].trim() });
  }

  return devices;
}

export async function listAvfoundationAudioDevices(): Promise<AvfoundationAudioDevice[]> {
  if (process.platform !== "darwin") {
    throw new Error("L'ascolto automatico del meeting richiede macOS e AVFoundation.");
  }

  try {
    await execFileAsync(
      "ffmpeg",
      ["-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
      { encoding: "utf8", maxBuffer: 2_000_000 },
    );
    return [];
  } catch (error: unknown) {
    if (typeof error !== "object" || error === null) throw error;
    const result = error as { stdout?: string; stderr?: string; code?: string | number };
    const devices = parseAvfoundationAudioDevices(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    if (devices.length > 0) return devices;
    if (result.code === "ENOENT") throw new Error("ffmpeg non è installato o non è nel PATH.");
    throw new Error("ffmpeg non ha restituito l'elenco dei dispositivi audio AVFoundation.");
  }
}

export function findAvfoundationAudioDevice(
  devices: readonly AvfoundationAudioDevice[],
  requestedName: string,
): AvfoundationAudioDevice | null {
  const normalized = requestedName.trim().toLocaleLowerCase();
  return (
    devices.find((device) => device.name.toLocaleLowerCase() === normalized) ??
    devices.find((device) => device.name.toLocaleLowerCase().includes(normalized)) ??
    null
  );
}
