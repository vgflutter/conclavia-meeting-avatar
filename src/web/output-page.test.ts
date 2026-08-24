import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const outputHtmlUrl = new URL("../../public/output.html", import.meta.url);
const outputScriptUrl = new URL("../../public/output.js", import.meta.url);
const managementScriptUrl = new URL("../../public/app.js", import.meta.url);

await test("keeps the OBS output free of meeting-console overlays", async () => {
  const [html, script, managementScript] = await Promise.all([
    readFile(outputHtmlUrl, "utf8"),
    readFile(outputScriptUrl, "utf8"),
    readFile(managementScriptUrl, "utf8"),
  ]);

  assert.doesNotMatch(html, /hand-request|IN ONDA|IN ASCOLTO|class="stage-badge"/i);
  assert.doesNotMatch(script, /api\/participation|handRequest/i);
  assert.match(script, /document\.createElement\("iframe"\)/);
  assert.match(script, /renderer\.streamId/);
  assert.match(script, /conclavia:frame-heartbeat/);
  assert.match(script, /FRAME_STALL_TIMEOUT_MS/);
  assert.match(script, /reconnectStalledPlayer/);
  assert.match(managementScript, /frame\.dataset\.stream !== streamId/);
  assert.match(managementScript, /status\.streamId \|\| ""/);
});

await test("publishes decoded-frame heartbeats from the clean Unreal player", async () => {
  const source = await readFile(
    new URL("../../unreal/ConclaviaStudio/Scripts/Start-ReviewStream.ps1", import.meta.url),
    "utf8",
  );

  assert.match(source, /requestVideoFrameCallback/);
  assert.match(source, /conclavia:frame-heartbeat/);
  assert.match(source, /presentedFrames/);
});
