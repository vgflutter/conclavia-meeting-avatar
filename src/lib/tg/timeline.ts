import type { TgFrame } from '@conclavia/avatar-kit/formats/tg';
import type { TgManifest } from './types';
import { presenterBeatAt } from '@conclavia/avatar-kit/performance';
export function tgFrameAt(manifest: TgManifest, seconds: number, portrait = false): TgFrame {
  const cue = manifest.cues.find(c => seconds >= c.start && seconds < c.end);
  const previous = cue ?? manifest.cues.findLast(c => c.start <= seconds);
  const window=previous?.performanceWindow;
  const motion=window&&previous&&Number.isFinite(window.start)&&Number.isFinite(window.end)&&window.start>=0&&window.start<=previous.start&&window.end>=previous.end&&window.end<=manifest.seconds?window:previous;
  const story = manifest.stories.find(s => s.id === previous?.storyId) ?? manifest.stories[0];
  const storyIndex = manifest.stories.findIndex(s => s.id === story?.id);
  const closing=previous?.storyId==='outro',it=manifest.product.language==='it';
  const frameIndex = cue ? Math.floor((seconds - cue.start) / (cue.frameSeconds ?? .04)) : -1;
  const phone = cue?.phones?.find(p => seconds - cue.start >= p.start && seconds - cue.start < p.end);
  let caption: string | undefined;
  if (cue) {
    const chunks: string[] = []; let chunk = '';
    for (const word of cue.text.split(/\s+/u)) { const candidate = chunk ? chunk + ' ' + word : word; if (candidate.length > (portrait ? 76 : 180) && chunk) { chunks.push(chunk); chunk = word; } else chunk = candidate; }
    if (chunk) chunks.push(chunk);
    caption = chunks[Math.min(chunks.length - 1, Math.floor((seconds - cue.start) / Math.max(.01, cue.end - cue.start) * chunks.length))];
  }
  return {
    caption,
    brand: manifest.product.name, edition: manifest.product.edition === 'it' ? 'Italia' : 'World', date: manifest.date,
    headline: closing?(it?'Cosa vuoi approfondire?':'What should we explore next?'):story?.headline??manifest.product.name, context:closing?(it?'Scrivici nei commenti.':'Tell us in the comments.'):story?.whyItMatters??'', change:closing?(it?'Meno rumore. Più contesto.':'Less noise. More context.'):story?.changedSinceYesterday??'',
    sources: (closing?[]:manifest.sources).filter(s => story?.sourceIds.includes(s.id)).map(s => s.publisher).filter((s, i, all) => all.indexOf(s) === i).slice(0, 3),
    story: storyIndex + 1, totalStories: manifest.stories.length, seconds, duration: manifest.seconds, portrait, demo: manifest.demo,
    speakers: Array.from({ length: manifest.product.presenters }, (_, i) => ({ name: manifest.product.language === 'it' ? i === 0 ? 'Riccardo' : 'Sofia' : i === 0 ? 'Alex' : 'Maya',
      appearance: i === 0 ? 'male' as const : 'female' as const,
      speaking: Boolean(cue && cue.speaker === i), emotion: cue?.speaker === i ? cue.mood : cue?.mood === 'empathy' ? 'empathy' : cue?.mood === 'doubt' ? 'curiosity' : 'attention', intensity: cue?.speaker === i ? cue.intensity : .32,
      audioLevel: cue?.speaker === i ? cue.levels?.[frameIndex] ?? 0 : 0, viseme: cue?.speaker === i ? phone?.viseme ?? 'rest' : 'rest',
      performance: previous ? {...presenterBeatAt({ start: motion!.start, end: motion!.end, seconds,
        cueId: `${manifest.date}:${motion!.start}:${previous.speaker}`, listening: cue?.speaker !== i,
        gaze: cue && cue.speaker !== i && manifest.product.presenters === 2 ? 'partner' : 'camera',gazeDirection:i===0?1:-1 }),choreography:previous.choreography}
        : { phase: 'settle' as const, progress: 1, listening: true, gaze: 'camera' as const } })),
  };
}
export function captionsVtt(manifest: TgManifest) {
  const stamp = (s: number) => { const ms = Math.round(s * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`; };
  return 'WEBVTT\n\n' + manifest.cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text.replace(/-->/gu, '→').replace(/[<>]/gu, '')}\n`).join('\n');
}
