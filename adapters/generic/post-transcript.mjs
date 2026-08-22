#!/usr/bin/env node

const [platform = "generic", speakerId = "participant-1", speakerName = "Vincenzo", ...parts] =
  process.argv.slice(2);
const text = parts.join(" ").trim();
if (!text) {
  process.stderr.write(
    "Usage: node adapters/generic/post-transcript.mjs <platform> <speaker-id> <speaker-name> <text>\n",
  );
  process.exitCode = 1;
} else {
  const response = await fetch("http://127.0.0.1:4310/api/transcript/segments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform,
      meetingId: "generic-cli",
      segmentId: crypto.randomUUID(),
      speakerId,
      speakerName,
      text,
      capturedAt: new Date().toISOString(),
      isFinal: true,
    }),
  });
  const body = await response.text();
  process.stdout.write(`${body}\n`);
  if (!response.ok) process.exitCode = 1;
}
