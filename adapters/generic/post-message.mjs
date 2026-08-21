#!/usr/bin/env node

const [platform = "generic", speakerName = "Vincenzo", ...messageParts] = process.argv.slice(2);
const text = messageParts.join(" ").trim();
if (!text) {
  process.stderr.write("Usage: node adapters/generic/post-message.mjs <platform> <speaker> <message>\n");
  process.exitCode = 1;
} else {
  const response = await fetch("http://127.0.0.1:4310/api/chat/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform,
      meetingId: "generic-cli",
      messageId: crypto.randomUUID(),
      speakerName,
      text,
      capturedAt: new Date().toISOString(),
    }),
  });
  const body = await response.text();
  process.stdout.write(`${body}\n`);
  if (!response.ok) process.exitCode = 1;
}
