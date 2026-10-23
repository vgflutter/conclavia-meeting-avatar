import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import { jobDirectory } from './artifacts';
const names = ['landscape.mp4', 'portrait.mp4', 'audio.mp3', 'captions.vtt', 'manifest.json'];
export function isAssetName(value: string) { return names.includes(value); }
export async function assetResponse(id: string, name: string, request: Request, publicMedia = false) {
  if (!isAssetName(name)) return new Response('Not found', { status: 404 });
  const file = path.join(jobDirectory(id), name), info = await stat(file);
  const headers: Record<string, string> = { 'Content-Type': name.endsWith('.mp4') ? 'video/mp4' : name.endsWith('.mp3') ? 'audio/mpeg' : name.endsWith('.vtt') ? 'text/vtt; charset=utf-8' : 'application/json', 'Accept-Ranges': 'bytes', 'Content-Length': String(info.size), 'Cache-Control': publicMedia ? 'private, max-age=60' : 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `inline; filename="conclavia-tg-${name}"` };
  const range = request.headers.get('range'); let start = 0, end = info.size - 1;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/u.exec(range);
    if (!match || (start = Number(match[1])) >= info.size || !Number.isSafeInteger(start)) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
    end = match[2] ? Math.min(Number(match[2]), info.size - 1) : Math.min(start + 2 * 1024 * 1024 - 1, info.size - 1);
    if (!Number.isSafeInteger(end) || end < start) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
    headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`; headers['Content-Length'] = String(end - start + 1);
  }
  if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
  // Stream through a bounded file handle; do not buffer whole videos in the web process.
  const handle = await open(file, 'r'); let position = start;
  const body = new ReadableStream<Uint8Array>({ async pull(output) {
    try { if (position > end) { await handle.close(); output.close(); return; } const data = new Uint8Array(Math.min(256 * 1024, end - position + 1)); const read = await handle.read(data, 0, data.length, position); if (!read.bytesRead) { await handle.close(); output.close(); return; } position += read.bytesRead; output.enqueue(data.subarray(0, read.bytesRead)); }
    catch { await handle.close().catch(() => undefined); output.error(new Error('Media non disponibile')); }
  }, async cancel() { await handle.close().catch(() => undefined); } });
  return new Response(body, { status: range ? 206 : 200, headers });
}
