import type { TgJob, TgManifest, TgProduct } from './types';

export const naturalDailyClock = (product: TgProduct) => product.productionStandard === 'cdaily-v1';
export const dailyRenderFps = (product: TgProduct) => naturalDailyClock(product) ? 50 : 25;
/** The product keeps its editorial target. The measured master owns its clock. */
export function validMasterClock(product: TgProduct, manifest?: TgManifest) {
  if (!manifest || !Number.isFinite(manifest.seconds) || manifest.product.seconds !== (naturalDailyClock(product) ? product.seconds : manifest.seconds)) return false;
  if (!naturalDailyClock(product)) return manifest.seconds === product.seconds;
  const firstNews=manifest.cues.findIndex(c=>c.storyId!=='intro'), introEnd=manifest.cues[firstNews-1]?.end, newsStart=manifest.cues[firstNews]?.start;
  const pointer=manifest.cues.filter(c=>c.intent==='point-down');
  return manifest.seconds >= 180 && manifest.seconds <= 420 && manifest.fps === 50
    && product.edition==='it'&&product.presenters===1&&/^[a-f\d]{64}$/u.test(manifest.voiceConfigSha256??'')
    && manifest.speech?.provider === 'elevenlabs' && manifest.speech.model === 'eleven_v4'
    && manifest.speech.voices.length === 1 && manifest.speech.voices[0] === 'Alex 2 - daily'
    && Math.abs((manifest.openingPause?.wordGapSeconds ?? 0)-2)<1/24000 && manifest.lipSync === 'word-anchored-estimate'
    && firstNews>0&&Number.isFinite(introEnd)&&Number.isFinite(newsStart)&&Math.abs(newsStart-introEnd-2)<1/24000
    && pointer.length===1&&pointer[0].storyId==='outro'&&pointer[0].gestureWord==='commenti'&&pointer[0].gestureAlignment==='word'
    && Number.isFinite(pointer[0].gestureAccent)&&pointer[0].gestureAccent!>=0&&pointer[0].gestureAccent!<pointer[0].end-pointer[0].start
    && manifest.cues.every((c,i) => c.alignment === 'word'&&Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start>=0&&c.end>c.start
      &&c.end<=manifest.seconds&&(!i||c.start>=manifest.cues[i-1].end-.01));
}
export const masterSeconds = (job: Pick<TgJob, 'product' | 'manifest'>) => job.manifest?.seconds ?? job.product.seconds;
