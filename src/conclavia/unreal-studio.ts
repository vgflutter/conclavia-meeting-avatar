import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DescribeInstancesCommand, EC2Client } from "@aws-sdk/client-ec2";
import { fromIni } from "@aws-sdk/credential-providers";

import { startLocalStudioInfrastructure } from "./studio-lifecycle.js";

export type UnrealStudioProfile = "meeting" | "pop" | "serious" | "lipsync" | "lipsync58";
export const unrealAvatarIds = ["showcase", "aera", "ada", "vivian", "jelena"] as const;
export type UnrealAvatarId = (typeof unrealAvatarIds)[number];

export interface UnrealPerformanceBeat {
  atMs: number;
  semanticMood: string;
  mood: string;
  intensity: number;
  focus: string;
  gesture: string;
}

export interface UnrealDirectorCue {
  speakerId: string;
  targetId?: string;
  speakerName: string;
  targetName?: string;
  shot: string;
  intent: string;
  bodyGesture?: "none" | "raise-hand" | "lower-hand" | "applause";
  listenerSemanticMood?: string;
  listenerMood?: string;
  listenerMoodIntensity?: number;
  expectedDurationMs: number;
  performanceBeats?: UnrealPerformanceBeat[];
}

export interface UnrealStudioHealth {
  ok: boolean;
  running?: boolean;
  runtimeRevision?: string;
  engineVersion?: string;
  profile?: UnrealStudioProfile;
  avatarId?: UnrealAvatarId;
  stageReady?: boolean;
  castCount?: number;
  cameraCount?: number;
  grade1SetReady?: boolean;
  grade1PropCount?: number;
  commercialLipSyncReady?: boolean;
  commercialModelRouteReady?: boolean;
  physicalGestureReady?: boolean;
  applauseGestureReady?: boolean;
  applauseExpressionReady?: boolean;
  applauseExpressionActive?: boolean;
  applauseExpressionDriver?: string;
  [key: string]: unknown;
}

export interface UnrealStudioConfig {
  playerUrl?: string;
  controlUrl?: string;
  supervisorUrl?: string;
  token?: string;
  instanceId?: string;
  awsRegion: string;
  awsProfile: string;
}

export type UnrealMachineState =
  | "pending"
  | "running"
  | "stopping"
  | "stopped"
  | "shutting-down"
  | "terminated"
  | "unknown"
  | "unconfigured";

export interface UnrealMachineStatus {
  configured: boolean;
  state: UnrealMachineState;
  checkedAt: string;
}

const machineStatusCache = new Map<
  string,
  { expiresAt: number; value: UnrealMachineStatus }
>();

function parseEnvironmentFile(path: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/u)
        .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
        .flatMap((line) => {
          const separator = line.indexOf("=");
          if (separator < 1) return [];
          const key = line.slice(0, separator).trim();
          const raw = line.slice(separator + 1).trim();
          return [[key, raw.replace(/^(['"])(.*)\1$/u, "$2")]];
        }),
    );
  } catch {
    return {};
  }
}

function runtimeEnvironment(): Record<string, string> {
  return {
    ...parseEnvironmentFile(resolve(process.cwd(), ".env")),
    ...parseEnvironmentFile(resolve(process.cwd(), ".env.local")),
  };
}

function configuredUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString().replace(/\/$/u, "");
  } catch {
    return undefined;
  }
}

export function getUnrealStudioConfig(): UnrealStudioConfig {
  const runtime = runtimeEnvironment();
  const value = (key: string): string | undefined =>
    runtime[key]?.trim() || process.env[key]?.trim() || undefined;
  const playerUrl = configuredUrl(value("UNREAL_STUDIO_PLAYER_URL"));
  const controlUrl = configuredUrl(value("UNREAL_STUDIO_CONTROL_URL"));
  const supervisorUrl = configuredUrl(value("UNREAL_STUDIO_SUPERVISOR_URL"));
  const token = value("UNREAL_STUDIO_TOKEN");
  const instanceId = value("UNREAL_STUDIO_INSTANCE_ID");
  return {
    ...(playerUrl ? { playerUrl } : {}),
    ...(controlUrl ? { controlUrl } : {}),
    ...(supervisorUrl ? { supervisorUrl } : {}),
    ...(token ? { token } : {}),
    ...(instanceId ? { instanceId } : {}),
    awsRegion:
      value("UNREAL_STUDIO_AWS_REGION") || value("AWS_REGION") || "eu-central-1",
    awsProfile:
      value("CONCLAVIA_AWS_PROFILE") || value("AWS_PROFILE") || "conclavia-studio",
  };
}

export function getConfiguredUnrealStudioProfile(): UnrealStudioProfile {
  const configured = runtimeEnvironment().UNREAL_STUDIO_PROFILE?.trim()
    || process.env.UNREAL_STUDIO_PROFILE?.trim();
  switch (configured) {
    case "meeting":
    case "pop":
    case "serious":
    case "lipsync":
    case "lipsync58":
      return configured;
    default:
      return "meeting";
  }
}

export function isUnrealAvatarId(value: unknown): value is UnrealAvatarId {
  return typeof value === "string"
    && (unrealAvatarIds as readonly string[]).includes(value);
}

function machineState(value: string | undefined): UnrealMachineState {
  switch (value) {
    case "pending":
    case "running":
    case "stopping":
    case "stopped":
    case "shutting-down":
    case "terminated":
      return value;
    default:
      return "unknown";
  }
}

export async function getUnrealMachineStatus(): Promise<UnrealMachineStatus> {
  const config = getUnrealStudioConfig();
  const checkedAt = new Date().toISOString();
  if (!config.instanceId) {
    return { configured: false, state: "unconfigured", checkedAt };
  }

  const cacheKey = `${config.awsRegion}:${config.awsProfile}:${config.instanceId}`;
  const cached = machineStatusCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: UnrealMachineStatus;
  const client = new EC2Client({
    region: config.awsRegion,
    credentials: fromIni({
      profile: config.awsProfile,
      clientConfig: { region: config.awsRegion },
    }),
    maxAttempts: 3,
  });
  try {
    const result = await client.send(
      new DescribeInstancesCommand({ InstanceIds: [config.instanceId] }),
    );
    value = {
      configured: true,
      state: machineState(result.Reservations?.[0]?.Instances?.[0]?.State?.Name),
      checkedAt,
    };
  } catch {
    value = { configured: true, state: "unknown", checkedAt };
  } finally {
    client.destroy();
  }

  machineStatusCache.set(cacheKey, { expiresAt: Date.now() + 5_000, value });
  return value;
}

function requestHeaders(config: UnrealStudioConfig, withBody = false): Record<string, string> {
  return {
    ...(withBody ? { "content-type": "application/json" } : {}),
    ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
  };
}

async function jsonRequest<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Studio 3D returned HTTP ${response.status}`);
  }
  return payload;
}

export function isGrade1HeroStudio(health: UnrealStudioHealth): boolean {
  return Boolean(
    health.runtimeRevision?.includes("grade1-hero-56-v")
      && health.grade1SetReady === true
      && (health.grade1PropCount ?? 0) >= 16
      && health.castCount === 1
      && health.cameraCount === 3,
  );
}

export function isUnreal58HeroStudio(health: UnrealStudioHealth): boolean {
  const meetingProfile = health.profile === "meeting";
  return Boolean(
    health.runtimeRevision?.includes("ue58-commercial-lipsync-v")
      && (meetingProfile || health.profile === "lipsync58")
      && health.stageReady === true
      && health.castCount === 1
      && (health.cameraCount ?? 0) >= (meetingProfile ? 1 : 9)
      && health.commercialModelRouteReady === true
      && health.commercialLipSyncReady === true,
  );
}

export async function getUnrealStudioHealth(): Promise<UnrealStudioHealth> {
  const config = getUnrealStudioConfig();
  if (!config.controlUrl) return { ok: false, running: false };
  try {
    return await jsonRequest<UnrealStudioHealth>(
      `${config.controlUrl}/health`,
      { headers: requestHeaders(config) },
      4_000,
    );
  } catch {
    return { ok: false, running: false };
  }
}

async function waitForStudioReady(
  profile: UnrealStudioProfile,
  avatarId: UnrealAvatarId,
  timeoutMs = 300_000,
): Promise<UnrealStudioHealth> {
  const deadline = Date.now() + timeoutMs;
  let latest: UnrealStudioHealth = { ok: false, running: false };
  while (Date.now() < deadline) {
    latest = await getUnrealStudioHealth();
    if (
      latest.ok
      && latest.stageReady
      && latest.avatarId === avatarId
      && (profile === "lipsync"
        ? isGrade1HeroStudio(latest)
        : profile === "lipsync58" || profile === "meeting"
          ? isUnreal58HeroStudio(latest)
          : true)
    ) {
      return latest;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
  }
  throw new Error(
    latest.running
      ? "Studio 3D online, ma il MetaHuman non è diventato pronto in tempo."
      : "Studio 3D non raggiungibile. Verifica GPU e Pixel Streaming.",
  );
}

export async function startUnrealStudio(
  profile: UnrealStudioProfile,
  avatarId: UnrealAvatarId,
): Promise<{ health: UnrealStudioHealth; playerUrl: string }> {
  const config = getUnrealStudioConfig();
  if (!config.playerUrl || !config.controlUrl) {
    throw new Error("Studio 3D non configurato. Esegui npm run studio:3d:start.");
  }

  const current = await getUnrealStudioHealth();
  const isCurrent = current.ok
    && current.stageReady
    && current.profile === profile
    && current.avatarId === avatarId
    && (profile === "lipsync"
      ? isGrade1HeroStudio(current)
      : profile === "lipsync58" || profile === "meeting"
        ? isUnreal58HeroStudio(current)
        : true);
  if (!isCurrent) {
    if (!config.supervisorUrl) {
      throw new Error("Supervisore Unreal non configurato.");
    }
    await jsonRequest(
      `${config.supervisorUrl}/start`,
      {
        method: "POST",
        headers: requestHeaders(config, true),
        body: JSON.stringify({ profile, avatarId }),
      },
      20_000,
    );
  }

  return {
    health: await waitForStudioReady(profile, avatarId),
    playerUrl: config.playerUrl,
  };
}

export async function startManagedUnrealStudio(
  avatarId: UnrealAvatarId,
): Promise<{ health: UnrealStudioHealth; playerUrl: string }> {
  const profile = getConfiguredUnrealStudioProfile();
  const machine = await getUnrealMachineStatus();
  let lifecycleRefreshed = false;
  if (machine.state !== "running") {
    await startLocalStudioInfrastructure();
    lifecycleRefreshed = true;
  }
  try {
    return await startUnrealStudio(profile, avatarId);
  } catch (error) {
    if (lifecycleRefreshed) throw error;
    await startLocalStudioInfrastructure();
    return startUnrealStudio(profile, avatarId);
  }
}

export async function stopUnrealStudio(): Promise<void> {
  const config = getUnrealStudioConfig();
  if (!config.supervisorUrl) return;
  await jsonRequest(
    `${config.supervisorUrl}/stop`,
    {
      method: "POST",
      headers: requestHeaders(config, true),
      body: "{}",
    },
    15_000,
  );
}

/**
 * Renews the GPU watchdog lease while a meeting renderer is actually armed.
 * A missing lease is intentionally treated as inactivity so a crashed local
 * companion cannot leave the paid GPU running indefinitely.
 */
export async function renewUnrealStudioLease(): Promise<void> {
  const config = getUnrealStudioConfig();
  if (!config.supervisorUrl) return;
  await jsonRequest(
    `${config.supervisorUrl}/session/lease`,
    {
      method: "POST",
      headers: requestHeaders(config, true),
      body: "{}",
    },
    4_000,
  );
}

export async function sendUnrealDirectorCue(cue: UnrealDirectorCue): Promise<void> {
  const config = getUnrealStudioConfig();
  if (!config.controlUrl) throw new Error("Control plane Unreal non configurato.");
  await jsonRequest(
    `${config.controlUrl}/director/cue`,
    {
      method: "POST",
      headers: requestHeaders(config, true),
      body: JSON.stringify(cue),
    },
    6_000,
  );
}

export async function sendUnrealPcm(pcm: Uint8Array): Promise<void> {
  const config = getUnrealStudioConfig();
  if (!config.supervisorUrl) throw new Error("Bridge audio Unreal non configurato.");
  const response = await fetch(`${config.supervisorUrl}/audio/pcm`, {
    method: "POST",
    headers: {
      ...requestHeaders(config),
      "content-type": "application/octet-stream",
    },
    body: Buffer.from(pcm),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Bridge audio Unreal returned HTTP ${response.status}`);
}

export async function playUnrealSpeech(
  pcm16: Uint8Array,
): Promise<{ durationMs: number }> {
  const config = getUnrealStudioConfig();
  if (!config.supervisorUrl) throw new Error("Riproduzione Unreal non configurata.");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${config.supervisorUrl}/audio/speech`, {
      method: "POST",
      headers: {
        ...requestHeaders(config),
        "content-type": "application/octet-stream",
      },
      body: Buffer.from(pcm16),
      signal: AbortSignal.timeout(8_000),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      durationMs?: number;
    };
    if (response.ok && typeof payload.durationMs === "number") {
      return { durationMs: payload.durationMs };
    }
    if (
      response.status === 503
      && payload.error === "commercial_model_warming"
      && attempt < 7
    ) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 350));
      continue;
    }
    throw new Error(payload.error || `Unreal speech returned HTTP ${response.status}`);
  }
  throw new Error("Il modello labiale Unreal non è diventato pronto in tempo.");
}

export async function standaloneRendererStatus(): Promise<Record<string, unknown>> {
  const config = getUnrealStudioConfig();
  const profile = getConfiguredUnrealStudioProfile();
  const machine = await getUnrealMachineStatus();
  const shouldProbe = ["running", "unknown", "unconfigured"].includes(machine.state);
  const health = shouldProbe
    ? await getUnrealStudioHealth()
    : { ok: false, running: false };
  const available = Boolean(
    health.ok
      && health.stageReady
      && health.commercialLipSyncReady
      && (profile === "lipsync58" || profile === "meeting"
        ? isUnreal58HeroStudio(health)
        : profile === "lipsync"
          ? isGrade1HeroStudio(health)
          : true),
  );
  const serverStatus = machine.state === "stopped" || machine.state === "terminated"
    ? "off"
    : machine.state === "pending"
      ? "booting"
      : machine.state === "stopping" || machine.state === "shutting-down"
        ? "stopping"
        : available
          ? "ready"
          : machine.state === "running"
            ? "online"
            : "unknown";
  return {
    configured: Boolean(config.playerUrl && config.controlUrl),
    canStart: Boolean(config.supervisorUrl || config.instanceId),
    available,
    serverStatus,
    machine,
    ...(health.ok && config.playerUrl ? { playerUrl: config.playerUrl } : {}),
    health,
    facialAnimation: "runtime-metahuman-lipsync",
    audioEngine: "polly-neural-with-generative-fallback",
  };
}
