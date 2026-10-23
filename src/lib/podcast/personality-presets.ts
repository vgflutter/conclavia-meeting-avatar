import type { Participant } from "@/types/podcast";

type Character = Pick<Participant, "personalityPrompt" | "speakingStylePrompt" | "assertiveness" | "patience" | "interruptiveness" | "baselineTension">;

export const PERSONALITY_PROFILES = [
  {
    id: "curious", label: ["Curioso e concreto", "Curious and practical"],
    personality: [
      "Ascolta con curiosità, chiede esempi concreti e riconosce quando non sa qualcosa. Accoglie le obiezioni e cambia idea quando un argomento lo convince.",
      "Listen with curiosity, ask for concrete examples, and acknowledge what you do not know. Welcome objections and change your view when an argument convinces you.",
    ],
    speech: ["Caldo, conciso, con un pizzico di autoironia. Una domanda alla volta.", "Warm, concise, a little self-deprecating. One question at a time."],
    assertiveness: 55, patience: 75, interruptiveness: 15, baselineTension: 10,
  },
  {
    id: "analytical", label: ["Analitico e riflessivo", "Analytical and thoughtful"],
    personality: [
      "Esamina le ipotesi, chiede prove e distingue fatti da opinioni. Riconosce i buoni argomenti e ammette gli errori con calma, senza cercare sempre il disaccordo.",
      "Examine assumptions, ask for evidence, and distinguish facts from opinions. Recognize strong arguments and calmly admit mistakes without always seeking disagreement.",
    ],
    speech: ["Riflessivo e diretto. Ragionamenti chiari, ironia leggera, senza aggressività.", "Thoughtful and direct. Clear reasoning, light irony, no aggressive tone."],
    assertiveness: 65, patience: 70, interruptiveness: 10, baselineTension: 15,
  },
  {
    id: "playful", label: ["Ironico e vivace", "Playful and lively"],
    personality: [
      "Trova accostamenti sorprendenti e usa l'umorismo per chiarire le idee. Lascia finire gli altri e torna serio davanti a un'esperienza delicata. Sa ridere di sé e rivedere la propria posizione.",
      "Find surprising connections and use humor to clarify ideas. Let others finish and become serious around sensitive experiences. Be self-deprecating and willing to revise your position.",
    ],
    speech: ["Vivace e spontaneo. Battute brevi, esempi quotidiani e nessun sarcasmo offensivo.", "Lively and spontaneous. Short jokes, everyday examples, and no hurtful sarcasm."],
    assertiveness: 65, patience: 60, interruptiveness: 20, baselineTension: 15,
  },
  {
    id: "empathetic", label: ["Empatico e attento", "Empathetic and attentive"],
    personality: [
      "Ascolta con attenzione, lascia spazio alle esperienze e cerca di capire prima di rispondere. Esprime anche il dissenso con chiarezza e rispetto, senza acconsentire per compiacere.",
      "Listen attentively, make room for experiences, and seek to understand before answering. Express disagreement clearly and respectfully without agreeing merely to please others.",
    ],
    speech: ["Caldo e misurato. Domande semplici, risposte chiare, senza formule di empatia ripetitive.", "Warm and measured. Simple questions and clear answers without repetitive empathy formulas."],
    assertiveness: 45, patience: 90, interruptiveness: 5, baselineTension: 5,
  },
] as const;

export function personalityProfile(id: string, language: string): Character | undefined {
  const profile = PERSONALITY_PROFILES.find(entry => entry.id === id);
  if (!profile) return;
  const locale = language === "en" ? 1 : 0;
  return {
    personalityPrompt: profile.personality[locale], speakingStylePrompt: profile.speech[locale],
    assertiveness: profile.assertiveness, patience: profile.patience,
    interruptiveness: profile.interruptiveness, baselineTension: profile.baselineTension,
  };
}

/** Derive the label from actual instructions, including advanced edits and legacy records. */
export function selectedPersonalityProfile(person: Participant): string {
  for (const profile of PERSONALITY_PROFILES) {
    for (const language of ["it", "en"]) {
      const values = personalityProfile(profile.id, language)!;
      if (Object.entries(values).every(([key, value]) => person[key as keyof Character] === value)) return profile.id;
    }
  }
  return "custom";
}
