import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const outputHtmlUrl = new URL("../../public/output.html", import.meta.url);
const outputScriptUrl = new URL("../../public/output.js", import.meta.url);

await test("keeps the OBS output free of meeting-console overlays", async () => {
  const [html, script] = await Promise.all([
    readFile(outputHtmlUrl, "utf8"),
    readFile(outputScriptUrl, "utf8"),
  ]);

  assert.doesNotMatch(html, /hand-request|IN ONDA|IN ASCOLTO|class="stage-badge"/i);
  assert.doesNotMatch(script, /api\/participation|handRequest/i);
  assert.match(script, /document\.createElement\("iframe"\)/);
});
