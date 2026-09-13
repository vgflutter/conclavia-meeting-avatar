import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, lstat, readdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { acquireRecoveryLock, checkConnection, quickOrigin, readEnvironment, readPublicOrigin, replacePublicOrigin, restoreTunnel, writeEnvironment } from "../../scripts/lib/local-tunnel.mjs";

const OLD = "https://old-test-host.trycloudflare.com";
const NEW = "https://new-test-host.trycloudflare.com";
// Fictional fixture values only: never load the actual .env.local in tests.
const ENV = `# retain comments\nMONGODB_URI=fixture-only\nCONCLAVIA_PUBLIC_URL=${OLD}\nINWORLD_API_KEY=fixture-only\n`;

test("only a bare HTTPS Quick Tunnel origin is accepted", () => {
  assert.equal(quickOrigin(NEW), NEW);
  for (const bad of ["http://old-test.trycloudflare.com", "https://x.trycloudflare.com.attacker.example", "https://x.trycloudflare.com:8443", "https://a@x.trycloudflare.com", "https://x.trycloudflare.com/path", "https://x.trycloudflare.com/?a=1", "https://x.trycloudflare.com/#x", "https://trycloudflare.com", "bad"]) {
    assert.equal(quickOrigin(bad), undefined);
    assert.throws(() => replacePublicOrigin(ENV, bad));
  }
});

test("only the public URL changes, keeping comments, CRLF, export and quotes", () => {
  const source = `# note\r\nMONGODB_URI=fixture-only\r\n export CONCLAVIA_PUBLIC_URL = '${OLD}' # public URL\r\nVOICE=Gianni\r\n`;
  const updated = replacePublicOrigin(source, NEW);
  assert.equal(updated, source.replace(OLD, NEW));
  assert.equal(readPublicOrigin(updated), NEW);
  assert.equal(replacePublicOrigin(updated, NEW), updated);
});

test("missing or blank setting is filled without replacing any other line", () => {
  assert.equal(replacePublicOrigin("VOICE=Gianni", NEW), `VOICE=Gianni\nCONCLAVIA_PUBLIC_URL=${NEW}\n`);
  assert.equal(replacePublicOrigin('CONCLAVIA_PUBLIC_URL="" # note\n', NEW), `CONCLAVIA_PUBLIC_URL="${NEW}" # note\n`);
});

test("duplicate, multiline or embedded lookalike settings fail closed", () => {
  assert.throws(() => replacePublicOrigin(ENV + `CONCLAVIA_PUBLIC_URL=${OLD}\n`, NEW), /più volte/u);
  assert.throws(() => replacePublicOrigin('CONCLAVIA_PUBLIC_URL="first\nsecond"\n', NEW), /sola riga/u);
  assert.throws(() => replacePublicOrigin(`FIXTURE="line\nCONCLAVIA_PUBLIC_URL=${OLD}\nend"\n`, NEW), /ambigua/u);
});

async function fixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), "conclavia-tunnel-unit-"));
  try { await fn(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test("atomic environment update preserves unrelated content and file permissions", async () => fixture(async directory => {
  const file = join(directory, ".env.local");
  await writeFile(file, ENV, { mode: 0o600 });
  await writeEnvironment(file, ENV, replacePublicOrigin(ENV, NEW));
  assert.equal(await readFile(file, "utf8"), ENV.replace(OLD, NEW));
  assert.equal((await lstat(file)).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(directory), [".env.local"]);
}));

test("concurrent environment edits are not overwritten", async () => fixture(async directory => {
  const file = join(directory, ".env.local");
  await writeFile(file, ENV + "OTHER=user-edit\n");
  await assert.rejects(writeEnvironment(file, ENV, ENV.replace(OLD, NEW)), /cambiato/u);
  assert.equal(await readFile(file, "utf8"), ENV + "OTHER=user-edit\n");
}));

test("missing files and symlinks are not recreated/replaced", async () => fixture(async directory => {
  await assert.rejects(readEnvironment(join(directory, "missing")), /originale/u);
  const target = join(directory, "real-env");
  const link = join(directory, ".env.local");
  await writeFile(target, ENV);
  await symlink(target, link);
  await assert.rejects(writeEnvironment(link, ENV, ENV.replace(OLD, NEW)), /simbolico/u);
  assert.equal(await readFile(target, "utf8"), ENV);
}));

test("health and management checks use no private meeting link or paid request", async () => {
  const calls = [];
  const result = await checkConnection(NEW, async (url, init) => {
    calls.push({ url, method: init.method || "GET", redirect: init.redirect });
    return url.endsWith("/api/health") ? Response.json({ status: "ok" }) : new Response("Not found", { status: 404 });
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 5);
  assert.ok(calls.every(call => call.redirect === "error" && !call.url.includes("meeting-room")));
  assert.equal(calls.at(-1).method, "POST");
});

test("DNS, database and exposed management routes cannot report ready", async () => {
  assert.equal((await checkConnection(NEW, async () => { throw new Error("private error detail"); })).ok, false);
  assert.equal((await checkConnection(NEW, async () => Response.json({ status: "error" }))).ok, false);
  assert.equal((await checkConnection(NEW, async url => url.endsWith("health") ? Response.json({ status: "ok" }) : new Response("management"))).unsafe, true);
});

function fake(overrides = {}) {
  let environment = ENV;
  const calls = [];
  const io = {
    readEnvironment: async () => environment,
    writeEnvironment: async (before, after) => { assert.equal(environment, before); environment = after; calls.push("write"); },
    inspectApp: async () => ({ pid: 42 }),
    localHealthy: async () => true,
    checkConnection: async () => ({ ok: false }),
    requireConnector: async () => { calls.push("connector"); },
    startTunnel: async () => { calls.push("tunnel"); return NEW; },
    stopApp: async () => { calls.push("stop"); },
    startApp: async origin => { assert.equal(origin, NEW); calls.push("app"); },
    waitLocal: async () => { calls.push("local"); },
    waitPublic: async () => { calls.push("public"); },
    ready: (origin, owned) => { calls.push(`ready:${owned}:${origin}`); },
    supervise: async () => { calls.push("supervise"); },
    cleanup: async () => { calls.push("cleanup"); },
    log: () => {},
    ...overrides,
  };
  return { io, calls, environment: () => environment, changeEnvironment: value => { environment = value; } };
}

test("healthy tunnel is reused without writes, child processes or restarts", async () => {
  const f = fake({ checkConnection: async () => ({ ok: true }) });
  await restoreTunnel(f.io);
  assert.deepEqual(f.calls, [`ready:false:${OLD}`]);
  assert.equal(f.environment(), ENV);
});

test("check mode failure never changes the environment or starts processes", async () => {
  const f = fake();
  await assert.rejects(restoreTunnel(f.io, { checkOnly: true }), /npm run tunnel/u);
  assert.deepEqual(f.calls, []);
  assert.equal(f.environment(), ENV);
});

test("dead tunnel: update URL, confirmed stop, startup and public checks before ready", async () => {
  const f = fake();
  await restoreTunnel(f.io);
  assert.deepEqual(f.calls, ["connector", "tunnel", "write", "stop", "app", "local", "public", `ready:true:${NEW}`, "supervise", "cleanup"]);
  assert.equal(f.environment(), ENV.replace(OLD, NEW));
});

test("cold start does not try to kill an absent server", async () => {
  const f = fake({ inspectApp: async () => undefined });
  await restoreTunnel(f.io);
  assert.ok(!f.calls.includes("stop"));
  assert.ok(f.calls.includes("app"));
});

test("custom domains and foreign port owners are refused before mutations", async () => {
  const custom = fake({ readEnvironment: async () => "CONCLAVIA_PUBLIC_URL=https://company.example\n" });
  await assert.rejects(restoreTunnel(custom.io), /personalizzato/u);
  assert.deepEqual(custom.calls, []);
  const foreign = fake({ inspectApp: async () => { throw new Error("foreign owner"); } });
  await assert.rejects(restoreTunnel(foreign.io), /foreign/u);
  assert.deepEqual(foreign.calls, []);
});

test("missing connector or exposed management routes never cause a restart", async () => {
  const missing = fake({ requireConnector: async () => { throw new Error("missing connector"); } });
  await assert.rejects(restoreTunnel(missing.io), /connector/u);
  assert.deepEqual(missing.calls, []);
  const unsafe = fake({ checkConnection: async () => ({ unsafe: true, ok: false, reason: "unsafe" }) });
  await assert.rejects(restoreTunnel(unsafe.io), /unsafe/u);
  assert.deepEqual(unsafe.calls, []);
});

for (const stage of ["startTunnel", "stopApp", "startApp", "waitLocal", "waitPublic", "supervise"]) {
  test(`failure at ${stage}: no false readiness, cleanup and safe environment rollback`, async () => {
    const f = fake({ [stage]: async () => { throw new Error("fixture failure"); } });
    await assert.rejects(restoreTunnel(f.io), /fixture failure/u);
    assert.equal(f.environment(), ENV);
    assert.equal(f.calls.at(-1), "cleanup");
    if (stage !== "supervise") assert.ok(!f.calls.some(call => call.startsWith("ready:")));
  });
}

test("failed recovery leaves a simultaneous user edit intact", async () => {
  const f = fake();
  f.io.waitPublic = async () => { f.changeEnvironment("USER=changed\n"); throw new Error("fixture failure"); };
  await assert.rejects(restoreTunnel(f.io), /fixture failure/u);
  assert.equal(f.environment(), "USER=changed\n");
  assert.equal(f.calls.at(-1), "cleanup");
});

test("only one recovery can own the lock; releasing it allows a new run", async () => {
  const first = await acquireRecoveryLock(0);
  const port = first.address().port;
  try { await assert.rejects(acquireRecoveryLock(port), /duplicato/u); }
  finally { await new Promise(resolve => first.close(resolve)); }
  const second = await acquireRecoveryLock(port);
  await new Promise(resolve => second.close(resolve));
});
