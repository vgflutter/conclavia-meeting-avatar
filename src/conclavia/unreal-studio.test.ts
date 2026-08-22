import assert from "node:assert/strict";
import test from "node:test";

import { isUnrealAvatarId, unrealAvatarIds } from "./unreal-studio.js";

await test("accepts only the MetaHuman identities installed by the studio builders", () => {
  assert.deepEqual(unrealAvatarIds, ["aera", "ada", "vivian", "jelena"]);
  for (const avatarId of unrealAvatarIds) assert.equal(isUnrealAvatarId(avatarId), true);
  assert.equal(isUnrealAvatarId(""), false);
  assert.equal(isUnrealAvatarId("mary"), false);
  assert.equal(isUnrealAvatarId({ avatarId: "aera" }), false);
});
