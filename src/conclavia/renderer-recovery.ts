import type { ConclaviaRendererStatus } from "./renderer.js";

export type RendererRecoveryAction = "none" | "arm" | "restart";

export interface RendererRecoveryState {
  enabled: boolean;
  configured: boolean;
  armed: boolean;
  starting: boolean;
  avatarProfile: string;
}

/**
 * Recover only an already-running renderer. A companion restart must not
 * silently start a stopped GPU, but it must reconnect to a healthy Unreal
 * session before the first meeting turn arrives.
 */
export function rendererRecoveryAction(
  state: RendererRecoveryState,
  status: ConclaviaRendererStatus,
): RendererRecoveryAction {
  if (
    !state.enabled ||
    !state.configured ||
    state.armed ||
    state.starting ||
    !status.available
  ) return "none";

  return status.avatarProfile === state.avatarProfile ? "arm" : "restart";
}
