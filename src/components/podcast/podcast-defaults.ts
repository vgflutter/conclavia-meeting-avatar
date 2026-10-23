import type { Participant, TalkInput } from "@/types/podcast";
import { DEFAULT_LLM_MODEL } from "@/lib/podcast/llm-models";
import { personalityProfile } from "@/lib/podcast/personality-presets";

export function defaultParticipant(index: number, english = false): Participant {
  return { kind: index === 2 ? "human" : "ai", sex: index === 1 ? "female" : "male", name: index === 0 ? "Riccardo" : index === 1 ? "Sofia" : english ? "Our guest" : "Il nostro ospite",
    role: index === 0 ? english ? "Host" : "Conduttore" : index === 1 ? english ? "Co-host" : "Co-conduttrice" : english ? "Invited expert" : "Esperto invitato",
    perspectiveMode: index === 2 ? "custom" : "automatic",
    perspectivePrompt: "",
    goals: index === 2 ? "" : english ? "Help the guest explain their experience; build on the other host’s contribution." : "Aiutare l’ospite a raccontare la sua esperienza; costruire sul contributo dell’altro conduttore.",
    speakingStylePrompt: index === 0 ? english ? "Warm, concise, a little self-deprecating. One question at a time." : "Caldo, conciso, con un pizzico di autoironia. Una domanda alla volta." : english ? "Thoughtful and direct. Light irony, no aggressive tone." : "Riflessiva e diretta. Ironia leggera, senza aggressività.",
    nonNegotiables: "", assertiveness: index === 0 ? 55 : 65, patience: index === 0 ? 75 : 65, interruptiveness: 15, baselineTension: index === 0 ? 10 : 20, voiceDelivery: "natural",
    ...(index < 2 ? personalityProfile(index === 0 ? "curious" : "analytical", english ? "en" : "it") : {}),
  };
}

export function defaultPodcast(english = false): TalkInput {
  return { title: english ? "Two points of view" : "Due punti di vista", topic: english ? "AI in everyday work" : "L’AI nel lavoro di tutti i giorni",
    centralQuestion: english ? "What should we delegate to AI, and what should remain human?" : "Cosa dovremmo delegare all’AI e cosa dovrebbe restare umano?",
    description: "", editorialInstructions: english ? "Give the guest room to speak. Alternate questions and follow-ups. Explore a concrete disagreement, then close with a useful takeaway. Avoid two hosts asking the same question." : "Lascia spazio all’ospite. Alterna domande e approfondimenti. Esplora un disaccordo concreto, poi chiudi con un punto utile da portare a casa. Evita che i due conduttori facciano la stessa domanda.",
    language: english ? "en" : "it", status: "ready", participants: [defaultParticipant(0, english), defaultParticipant(1, english), defaultParticipant(2, english)],
    moderator: { kind: "none", style: "facilitating", canInterrupt: false, manageTime: true, summarizeAtEnd: true },
    settings: { maxTurns: 12, targetDurationMinutes: 5, videoMode: "cartoon", studioTheme: "clean-line", studioLayout: "studio", studioCast: "original", studioGuest: "auto", defaultModel: DEFAULT_LLM_MODEL, allowInterruptions: false, pace: "balanced" } };
}
