import 'server-only';
import { createHash } from 'node:crypto';
import { elevenLabsVoice, type ElevenLabsSettings } from '@conclavia/avatar-kit/speech/server';
import { TgEditorialError } from './editorial';

export const ALEX2_VOICE_NAME = 'Alex 2 - daily';
/** This module never exports credential values through status or manifests. */
export function alex2Config(env: Record<string,string|undefined> = process.env) {
  const apiKey = env.TG_ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY;
  const voiceId = env.TG_IT_ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId || !/^[A-Za-z0-9_-]{8,80}$/u.test(voiceId)) throw new TgEditorialError('Alex 2: configurare privatamente chiave ElevenLabs e ID della voce approvata');
  if (env.TG_ELEVENLABS_MODEL_ID !== 'eleven_v4') throw new TgEditorialError('Alex 2: configurare esplicitamente il modello approvato eleven_v4');
  let settings: ElevenLabsSettings | undefined;
  if (env.TG_IT_ELEVENLABS_SETTINGS) {
    try {
      settings = JSON.parse(env.TG_IT_ELEVENLABS_SETTINGS);
      if (!settings || Array.isArray(settings) || typeof settings !== 'object'
        || Object.keys(settings).some(k => !['stability','similarity_boost'].includes(k))
        || Object.values(settings).some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)) throw Error();
    } catch { throw new TgEditorialError('Alex 2: impostazioni private non valide; usare soltanto stabilità e somiglianza verificate'); }
  }
  return {apiKey, voiceId, model:'eleven_v4' as const, settings};
}
export function alex2ConfigStatus(env: Record<string,string|undefined> = process.env) {
  let configured = false;
  try { alex2Config(env); configured = true; } catch {}
  return {configured, keyPresent:Boolean(env.TG_ELEVENLABS_API_KEY || env.ELEVENLABS_API_KEY), voiceIdPresent:Boolean(env.TG_IT_ELEVENLABS_VOICE_ID),
    modelSelected:env.TG_ELEVENLABS_MODEL_ID === 'eleven_v4', settingsOverridePresent:Boolean(env.TG_IT_ELEVENLABS_SETTINGS)};
}
export const alex2ConfigDigest = (config: ReturnType<typeof alex2Config>) => createHash('sha256')
  .update(JSON.stringify({voiceId:config.voiceId,model:config.model,settings:config.settings ?? null})).digest('hex');
export async function verifyAlex2Identity(signal: AbortSignal, config = alex2Config()) {
  const voice = await elevenLabsVoice(config.voiceId, signal, {apiKey:config.apiKey});
  if (voice.name !== ALEX2_VOICE_NAME) throw new TgEditorialError('La voce configurata non è Alex 2 - daily: nessuna sostituzione automatica');
  return config;
}
