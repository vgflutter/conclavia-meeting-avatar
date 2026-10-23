import 'server-only';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { jobDirectory, inspectArtifact } from './artifacts';
import { mediaCheckIssues } from './final-review-policy';
import { captionsVtt } from './timeline';
import type { TgJob, TgMediaCheck } from './types';

/** Bounded binary output; no shell, URLs, or provider calls. */
export function mediaCommand(file: string, args: string[], signal: AbortSignal, maxBytes = 24_000_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'], signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]) });
    const chunks: Buffer[] = []; let bytes = 0, overflow = false;
    child.stdout.on('data', b => { bytes += b.length; if (bytes > maxBytes) { overflow = true; child.kill(); } else chunks.push(b); });
    child.stderr.resume(); child.on('error', reject);
    child.on('close', code => code === 0 && !overflow ? resolve(Buffer.concat(chunks)) : reject(new Error('Controllo media interrotto: file non decodificabile o troppo grande')));
  });
}
export function measurePcm(pcm: Buffer) {
  const count = pcm.length / 2;
  if (!count || !Number.isInteger(count)) throw new Error('Traccia audio non decodificabile');
  let power = 0, peak = 0, clipped = 0, first = -1, last = -1;
  for (let i = 0; i < count; i++) {
    const sample = Math.abs(pcm.readInt16LE(i * 2) / 32768);
    power += sample * sample; peak = Math.max(peak, sample); if (sample > .995) clipped++;
    if (sample > .01) { if (first < 0) first = i; last = i; }
  }
  return { rms: Math.sqrt(power / count), peak, clippedRatio: clipped / count,
    leadingSilence: (first < 0 ? count : first) / 16000, trailingSilence: (last < 0 ? count : count - last - 1) / 16000 };
}
export function reviewSampleTimes(job: TgJob) {
  const cues = job.manifest?.cues ?? [];
  // Cover beginning, middle and end plus story/mood transitions. Max six per format.
  const times = [1, job.product.seconds / 2, job.product.seconds - 3];
  for (let i = 1; i < cues.length && times.length < 6; i++) {
    if (cues[i].storyId !== cues[i - 1].storyId || cues[i].mood !== cues[i - 1].mood) times.push(cues[i].start + .7);
  }
  return [...new Set(times.filter(t => Number.isFinite(t) && t >= 0 && t < job.product.seconds).map(t => Math.round(t * 100) / 100))].sort((a, b) => a - b);
}
export async function inspectFinalMedia(job: TgJob, signal: AbortSignal, options={bundle:true}) {
  for (const asset of job.assets) {
    const actual = await inspectArtifact(job.id, asset.name);
    if (actual.bytes !== asset.bytes || actual.sha256 !== asset.sha256) throw new Error('Media cambiati prima della revisione finale');
  }
  if(options.bundle){
    if(!job.manifest||!['landscape.mp4','portrait.mp4','audio.mp3','captions.vtt','manifest.json'].every(name=>job.assets.some(a=>a.name===name)))throw new Error('Pacchetto finale incompleto');
    const vtt=await readFile(path.join(jobDirectory(job.id),'captions.vtt'),'utf8');
    if(vtt!==captionsVtt(job.manifest))throw new Error('Sottotitoli non corrispondenti alla timeline');
    const manifest=await readFile(path.join(jobDirectory(job.id),'manifest.json'),'utf8');
    if(JSON.stringify(JSON.parse(manifest))!==JSON.stringify(job.manifest))throw new Error('Manifest del pacchetto non corrispondente alla timeline');
  }
  const media: TgMediaCheck[] = [], frames: { format: 'landscape' | 'portrait'; at: number; data: string }[] = [];
  for (const format of ['landscape', 'portrait'] as const) {
    const file = path.join(jobDirectory(job.id), `${format}.mp4`);
    const probe = JSON.parse((await mediaCommand('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], signal, 200000)).toString());
    const video = probe.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
    if (!video || !probe.streams?.some((s: { codec_type: string }) => s.codec_type === 'audio')) throw new Error(`Video o audio ${format} mancanti`);
    const pcm = await mediaCommand('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'], signal);
    if (Math.abs(pcm.length / 32000 - job.product.seconds) > .2) throw new Error(`Traccia audio ${format} incompleta`);
    await mediaCommand('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-map', '0:v:0', '-an', '-f', 'null', '-'], signal, 1000);
    media.push({ format, width: Number(video.width), height: Number(video.height), seconds: Number(probe.format?.duration), ...measurePcm(pcm) });
    for (const at of reviewSampleTimes(job)) {
      const data = await mediaCommand('ffmpeg', ['-v', 'error', '-xerror', '-ss', String(at), '-i', file, '-frames:v', '1', '-vf', 'scale=640:-2', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1'], signal, 1200000);
      if (data.length < 1000) throw new Error('Fotogramma finale non disponibile');
      frames.push({ format, at, data: data.toString('base64') });
    }
  }
  const issues = mediaCheckIssues(media, job.product.seconds);
  if (issues.length) throw new Error(issues.join('; '));
  return { media, frames };
}
