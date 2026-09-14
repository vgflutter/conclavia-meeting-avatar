import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, lstat, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { once } from "node:events";
import { sanitizeDiagnosticText } from "../../src/lib/diagnostic-redaction.mjs";
import { captureDiagnosticStream, createLocalDiagnosticLog } from "../../scripts/lib/local-diagnostic-log.mjs";
import { diagnoseEntry } from "../../scripts/diagnose-entry.mjs";

test("diagnostics remove credentials, invitation URLs, capabilities and private payloads", () => {
  const fixtures = [
    ['TLS error https://teams.live.com/meet/123?p=private-invitation', 'private-invitation'],
    ['GET /api/meeting-room/private-capability/state?meeting_token=private-token 500', 'private-capability'],
    ['Authorization: Token short-key', 'short-key'],
    ['{"apiKey":"short-key"}', 'short-key'],
    ['password="private value with spaces"', 'private value'],
    ['mongodb+srv://user:short-key@db.example/database', 'short-key'],
    ['{"transcript":"private conversation"}', 'private conversation'],
    ['error headers: { "cookie": "private-cookie" }', 'private-cookie'],
    ['Error for someone@example.com at /Users/private-user/file', 'private-user'],
    ['INWORLD_API_KEY=fictional-only-key', 'fictional-only-key'],
    ['Token abcdefghijklmnopqrstuvwxyz1234567890', 'abcdefghijklmnopqrstuvwxyz'],
  ];
  for (const [input, secret] of fixtures) assert.ok(!sanitizeDiagnosticText(input).includes(secret), input);
  assert.equal(sanitizeDiagnosticText("TimeoutException: could not find join button"), "TimeoutException: could not find join button");
  assert.equal(sanitizeDiagnosticText("x".repeat(33000)), "[oversized diagnostic omitted]");
  assert.ok(!sanitizeDiagnosticText("error\nforged entry\x1b[31m").includes("\n"));
});

async function fixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-diagnostics-test-"));
  try { await fn(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test("runtime log is private, bounded and rotated; no raw input reaches disk", async () => fixture(async directory => {
  const logs = join(directory, "logs");
  const logger = await createLocalDiagnosticLog(logs, { maxBytes: 500 });
  for (let i = 0; i < 20; i++) logger.write("app:stderr", `failure ${i}: https://example.com/?token=private-token`);
  await logger.close();
  assert.deepEqual((await readdir(logs)).sort(), ["runtime.log", "runtime.log.1"]);
  for (const name of await readdir(logs)) {
    const path = join(logs, name), info = await lstat(path), text = await readFile(path, "utf8");
    assert.equal(info.mode & 0o777, 0o600);
    assert.ok(info.size <= 500);
    assert.ok(!text.includes("private-token"));
    for (const line of text.trim().split("\n")) assert.ok(JSON.parse(line).at);
  }
  assert.equal((await lstat(logs)).mode & 0o777, 0o700);
  assert.match(await readFile(join(logs, "runtime.log"), "utf8"), /failure 19/);
}));

test("tokens split across stream chunks and oversized/incomplete lines cannot leak", async () => fixture(async directory => {
  const logs = join(directory, "logs"), logger = await createLocalDiagnosticLog(logs);
  const stream = new PassThrough();
  captureDiagnosticStream(stream, "app:stderr", logger);
  stream.write("Failed Authorization: Tok");
  stream.write("en private-key\n");
  stream.write("a".repeat(17000));
  stream.write("private-tail\n");
  stream.end("INWORLD_API_KEY=private-unfinished");
  await once(stream, "end");
  await logger.close();
  const text = await readFile(join(logs, "runtime.log"), "utf8");
  assert.ok(!text.includes("private-"));
  assert.match(text, /oversized/);
  assert.match(text, /incomplete/);
}));

test("symlink diagnostic files are refused without touching the target", async () => fixture(async directory => {
  const target = join(directory, "untouched"), logs = join(directory, "logs");
  await writeFile(target, "keep");
  const logger = await createLocalDiagnosticLog(logs);
  await logger.close();
  await rm(join(logs, "runtime.log"));
  await symlink(target, join(logs, "runtime.log"));
  await assert.rejects(createLocalDiagnosticLog(logs));
  assert.equal(await readFile(target, "utf8"), "keep");
}));

test("entry CLI only reads the loopback diagnostic endpoint; no env or paid API", async () => {
  const id = "a".repeat(24), calls = [];
  const fetcher = async (url, init) => { calls.push({ url, ...init }); return Response.json({ logs: [] }); };
  assert.deepEqual(await diagnoseEntry(id, { fetcher }), { logs: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].redirect, "error");
  assert.equal(calls[0].url, `http://127.0.0.1:3000/api/meetings/${id}/diagnostics`);
  for (const origin of ["https://example.com", "http://localhost@evil.example", "http://127.0.0.1/?secret=x"]) {
    await assert.rejects(diagnoseEntry(id, { origin, fetcher }));
  }
  assert.equal(calls.length, 1);
});
