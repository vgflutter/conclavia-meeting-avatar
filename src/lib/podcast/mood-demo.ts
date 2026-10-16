import type { PodcastEmotion } from "@conclavia/avatar-kit/types/podcast";

export const PODCAST_MOOD_OPTIONS = [
  { id: "attention", label: { it: "Attenzione", en: "Attention" }, color: "#71816a", note: { it: "Presenza calma e sguardo stabile", en: "Calm presence and steady gaze" } },
  { id: "curiosity", label: { it: "Curiosità", en: "Curiosity" }, color: "#b68b49", note: { it: "Sguardo aperto e lieve avvicinamento", en: "Open gaze and a gentle lean forward" } },
  { id: "doubt", label: { it: "Dubbio", en: "Doubt" }, color: "#8d7d9e", note: { it: "Sopracciglio asimmetrico e pausa riflessiva", en: "An asymmetric brow and a thoughtful pause" } },
  { id: "agreement", label: { it: "Accordo", en: "Agreement" }, color: "#64886f", note: { it: "Un cenno del capo e viso disteso", en: "A nod and a relaxed expression" } },
  { id: "amusement", label: { it: "Divertimento", en: "Amusement" }, color: "#c68d5f", note: { it: "Sorriso, guance e spalle più libere", en: "A smile, lifted cheeks, and relaxed shoulders" } },
  { id: "empathy", label: { it: "Empatia", en: "Empathy" }, color: "#af7c88", note: { it: "Sguardo morbido e ascolto raccolto", en: "A softer gaze and attentive listening" } },
  { id: "disagreement", label: { it: "Disaccordo", en: "Disagreement" }, color: "#ad6b5b", note: { it: "Fronte più tesa e gesto di obiezione", en: "A tenser brow and a measured objection" } },
  { id: "surprise", label: { it: "Sorpresa", en: "Surprise" }, color: "#858cb6", note: { it: "Occhi più aperti e un piccolo arretramento", en: "Wider eyes and a slight lean back" } },
] as const satisfies ReadonlyArray<{ id: PodcastEmotion; label: { it: string; en: string }; color: string; note: { it: string; en: string } }>;

export function getPodcastMood(value: PodcastEmotion) { return PODCAST_MOOD_OPTIONS.find(mood => mood.id === value) ?? PODCAST_MOOD_OPTIONS[0]; }

/** Written rehearsal material: no provider calls, voice synthesis, or simulated audio. */
export const MOOD_DEMO_SENTENCES = [
  { speakerIndex: 0, mood: "attention", intensity: .56, listenerMood: "curiosity", listenerIntensity: .49, text: { it: "Prima di rispondere, vorrei capire bene la tua esperienza.", en: "Before I answer, I’d like to understand your experience." } },
  { speakerIndex: 1, mood: "curiosity", intensity: .75, listenerMood: "attention", listenerIntensity: .53, text: { it: "E qual è stato il momento in cui hai cambiato idea?", en: "And when did you find yourself changing your mind?" } },
  { speakerIndex: 0, mood: "doubt", intensity: .69, listenerMood: "empathy", listenerIntensity: .57, text: { it: "Mi chiedo se questo esempio basti per arrivare a quella conclusione.", en: "I wonder whether this example is enough to reach that conclusion." } },
  { speakerIndex: 1, mood: "agreement", intensity: .70, listenerMood: "amusement", listenerIntensity: .40, text: { it: "Su questo siamo d’accordo: la scelta deve restare alle persone.", en: "We agree on this: the choice should stay with people." } },
  { speakerIndex: 0, mood: "amusement", intensity: .76, listenerMood: "amusement", listenerIntensity: .52, text: { it: "Quindi l’AI fa il lavoro e noi litighiamo su chi prende il merito?", en: "So the AI does the work, and we argue about who gets the credit?" } },
  { speakerIndex: 1, mood: "empathy", intensity: .72, listenerMood: "attention", listenerIntensity: .62, text: { it: "Capisco la fatica: cambiare un’abitudine richiede tempo e fiducia.", en: "I understand the difficulty: changing a habit takes time and trust." } },
  { speakerIndex: 0, mood: "disagreement", intensity: .68, listenerMood: "doubt", listenerIntensity: .48, text: { it: "Qui non ti seguo: essere più veloci non significa scegliere meglio.", en: "I see it differently: being faster doesn’t mean making better choices." } },
  { speakerIndex: 1, mood: "surprise", intensity: .82, listenerMood: "curiosity", listenerIntensity: .63, text: { it: "Davvero? Non mi aspettavo che il risultato fosse così diverso!", en: "Really? I didn’t expect the result to be so different!" } },
] as const satisfies ReadonlyArray<{ speakerIndex: number; mood: PodcastEmotion; intensity: number; listenerMood: PodcastEmotion; listenerIntensity: number; text: { it: string; en: string } }>;

export const MOOD_DEMO_DURATION_MS = 6800;
export function moodDemoPhase(position: number): { phase: "anticipation" | "delivery" | "settle"; progress: number } {
  if (position < 800) return { phase: "anticipation", progress: Math.max(0, position) / 800 };
  if (position < 4700) return { phase: "delivery", progress: (position - 800) / 3900 };
  return { phase: "settle", progress: Math.min(1, (position - 4700) / 2100) };
}
