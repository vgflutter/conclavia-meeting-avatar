import assert from "node:assert/strict";
import test from "node:test";

import {
  isUnreal58HeroStudio,
  isUnrealAvatarId,
  unrealAvatarIds,
} from "./unreal-studio.js";

await test("accepts only the MetaHuman identities installed by the studio builders", () => {
  assert.deepEqual(unrealAvatarIds, ["showcase", "aera", "ada", "vivian", "jelena"]);
  for (const avatarId of unrealAvatarIds) assert.equal(isUnrealAvatarId(avatarId), true);
  assert.equal(isUnrealAvatarId(""), false);
  assert.equal(isUnrealAvatarId("mary"), false);
  assert.equal(isUnrealAvatarId({ avatarId: "aera" }), false);
});

await test("accepts only a ready isolated meeting stage as the production UE 5.8 renderer", () => {
  const health = {
    ok: true,
    profile: "meeting" as const,
    runtimeRevision: "ue58-commercial-lipsync-v16-meeting-presence",
    stageReady: true,
    castCount: 1,
    cameraCount: 2,
    commercialModelRouteReady: true,
    commercialLipSyncReady: true,
  };
  assert.equal(isUnreal58HeroStudio(health), true);
  assert.equal(isUnreal58HeroStudio({ ...health, cameraCount: 1 }), false);
  assert.equal(isUnreal58HeroStudio({ ...health, profile: "pop" }), false);
  assert.equal(isUnreal58HeroStudio({ ...health, stageReady: false }), false);
});
