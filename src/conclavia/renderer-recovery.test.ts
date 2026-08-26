import assert from "node:assert/strict";
import test from "node:test";

import {
  rendererRecoveryAction,
  type RendererRecoveryState,
} from "./renderer-recovery.js";
import type { ConclaviaRendererStatus } from "./renderer.js";

const state: RendererRecoveryState = {
  enabled: true,
  configured: true,
  armed: false,
  starting: false,
  avatarProfile: "showcase",
};

const status: ConclaviaRendererStatus = {
  configured: true,
  available: true,
  serverStatus: "ready",
  playerUrl: "http://renderer.example/conclavia.html",
  avatarProfile: "showcase",
};

await test("re-arms an already-running matching Unreal session", () => {
  assert.equal(rendererRecoveryAction(state, status), "arm");
});

await test("requests the configured avatar when the live session has another profile", () => {
  assert.equal(
    rendererRecoveryAction(state, { ...status, avatarProfile: "jelena" }),
    "restart",
  );
});

await test("never starts a stopped GPU as an automatic recovery side effect", () => {
  assert.equal(
    rendererRecoveryAction(state, {
      ...status,
      available: false,
      serverStatus: "stopped",
    }),
    "none",
  );
});

await test("honours explicit stop and existing start or ready states", () => {
  assert.equal(rendererRecoveryAction({ ...state, enabled: false }, status), "none");
  assert.equal(rendererRecoveryAction({ ...state, starting: true }, status), "none");
  assert.equal(rendererRecoveryAction({ ...state, armed: true }, status), "none");
});
