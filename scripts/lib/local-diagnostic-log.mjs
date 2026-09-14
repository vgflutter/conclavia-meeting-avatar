import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { sanitizeDiagnosticText } from "../../src/lib/diagnostic-redaction.mjs";

// Two bounded, private JSONL files. One launcher owns them via the recovery lock.
export async function createLocalDiagnosticLog(directory, { maxBytes = 1024 * 1024, onError = () => {} } = {}) {
  for (const path of [dirname(directory), directory]) {
    await mkdir(path, { recursive: true, mode: 0o700 });
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Unsafe diagnostic directory");
  }
  await chmod(directory, 0o700);
  const path = join(directory, "runtime.log"), previous = `${path}.1`;
  async function openPrivate() {
    const file = await open(path, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    const info = await file.stat();
    if (!info.isFile() || info.nlink !== 1) { await file.close(); throw new Error("Unsafe diagnostic file"); }
    await file.chmod(0o600);
    return { file, size: info.size };
  }
  let { file, size } = await openPrivate();
  let queue = Promise.resolve(), queuedBytes = 0, failed = false, closed = false;
  function write(source, message) {
    if (failed || closed) return;
    const safe = sanitizeDiagnosticText(message);
    if (!safe) return;
    const line = JSON.stringify({ at: new Date().toISOString(), source: /^(?:app|cloudflared):(?:stdout|stderr)$/.test(source) ? source : "local", message: safe }) + "\n";
    const bytes = Buffer.byteLength(line);
    if (queuedBytes + bytes > 256 * 1024) return; // Never let logging exhaust RAM.
    queuedBytes += bytes;
    queue = queue.then(async () => {
      if (failed) return;
      if (size + bytes > maxBytes) {
        try {
          const info = await lstat(previous);
          if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error("Unsafe rotated log");
        } catch (error) { if (error.code !== "ENOENT") throw error; }
        await file.close();
        await rename(path, previous);
        ({ file, size } = await openPrivate());
      }
      await file.write(line);
      size += bytes;
    }).catch(() => { failed = true; onError(); }).finally(() => { queuedBytes -= bytes; });
  }
  return {
    write,
    async close() { closed = true; await queue; await file.close().catch(() => {}); },
  };
}

// Redact only after reconstructing a full line: a token/URL can cross chunks.
// Oversized lines and incomplete EOF tails are discarded, not partly exposed.
export function captureDiagnosticStream(stream, source, logger) {
  const decoder = new StringDecoder("utf8");
  let pending = "", dropping = false;
  stream.on("data", chunk => {
    pending += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    let end;
    while ((end = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, end);
      pending = pending.slice(end + 1);
      if (!dropping && line.length <= 16384) logger.write(source, line);
      else logger.write(source, "[oversized log line omitted]");
      dropping = false;
    }
    if (pending.length > 16384) { pending = ""; dropping = true; }
  });
  stream.on("end", () => {
    if (pending || dropping || decoder.end()) logger.write(source, "[incomplete log line omitted]");
  });
}
