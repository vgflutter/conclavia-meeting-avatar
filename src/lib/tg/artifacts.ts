import { createHash } from 'node:crypto';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import type { TgAsset } from './types';
// Runtime-mounted media are not application bundle dependencies.
export function artifactRoot() { return path.resolve(/* turbopackIgnore: true */ process.env.TG_ARTIFACT_DIR || path.join(process.cwd(), '.tg-artifacts')); }
export function jobDirectory(id: string) { if (!/^[a-f\d]{24}$/u.test(id)) throw new Error('Id TG non valido'); return path.join(artifactRoot(), id); }
export async function writeArtifact(id: string, name: TgAsset['name'], data: Buffer | string, duration?: number): Promise<TgAsset> {
  const dir = jobDirectory(id); await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, name), temporary = file + '.partial';
  await writeFile(temporary, data, { mode: 0o600 }); await rename(temporary, file);
  return inspectArtifact(id, name, duration);
}
export async function inspectArtifact(id: string, name: TgAsset['name'], duration?: number): Promise<TgAsset> {
  const file = path.join(jobDirectory(id), name), before = await stat(file), hash = createHash('sha256');
  let bytes=0;
  // The worker and web process must not buffer whole HD episodes to verify them.
  for await (const chunk of createReadStream(file)) { hash.update(chunk);bytes+=chunk.length; }
  const after=await stat(file);
  if(bytes!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ino!==after.ino)throw new Error('Artifact cambiato durante il controllo');
  return { name, bytes, sha256: hash.digest('hex'), ...(duration === undefined ? {} : { duration }) };
}
