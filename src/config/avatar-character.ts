export interface AvatarCharacterTraits {
  calmness: number;
  assertiveness: number;
  impulsiveness: number;
  empathy: number;
  concision: number;
  expressiveness: number;
}

export const defaultCharacterTraits: AvatarCharacterTraits = {
  calmness: 72,
  assertiveness: 62,
  impulsiveness: 30,
  empathy: 70,
  concision: 78,
  expressiveness: 58,
};

const traitLabels: Readonly<Record<keyof AvatarCharacterTraits, string>> = {
  calmness: "Calma",
  assertiveness: "Assertività",
  impulsiveness: "Irruenza",
  empathy: "Empatia",
  concision: "Sintesi",
  expressiveness: "Espressività",
};

function traitValue(value: unknown, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} non valida`);
  }
  const score = Math.round(value);
  if (score < 0 || score > 100) {
    throw new Error(`${label} deve essere compresa tra 0 e 100`);
  }
  return score;
}

export function characterTraits(
  value: unknown,
  fallback: AvatarCharacterTraits = defaultCharacterTraits,
): AvatarCharacterTraits {
  if (value === undefined) return { ...fallback };
  if (typeof value !== "object" || value === null) {
    throw new Error("Profilo caratteriale non valido");
  }
  const record = value as Record<string, unknown>;
  return {
    calmness: traitValue(record.calmness, fallback.calmness, traitLabels.calmness),
    assertiveness: traitValue(
      record.assertiveness,
      fallback.assertiveness,
      traitLabels.assertiveness,
    ),
    impulsiveness: traitValue(
      record.impulsiveness,
      fallback.impulsiveness,
      traitLabels.impulsiveness,
    ),
    empathy: traitValue(record.empathy, fallback.empathy, traitLabels.empathy),
    concision: traitValue(record.concision, fallback.concision, traitLabels.concision),
    expressiveness: traitValue(
      record.expressiveness,
      fallback.expressiveness,
      traitLabels.expressiveness,
    ),
  };
}

function band(value: number): "bassa" | "media" | "alta" {
  if (value < 35) return "bassa";
  if (value > 65) return "alta";
  return "media";
}

export function characterInstructions(traits: AvatarCharacterTraits): string {
  return [
    `PROFILO CARATTERIALE 0-100: calma ${traits.calmness}, assertività ${traits.assertiveness}, irruenza ${traits.impulsiveness}, empatia ${traits.empathy}, sintesi ${traits.concision}, espressività ${traits.expressiveness}.`,
    `Interpreta questi valori in modo coerente: calma ${band(traits.calmness)}, assertività ${band(traits.assertiveness)}, irruenza ${band(traits.impulsiveness)}, empatia ${band(traits.empathy)}, sintesi ${band(traits.concision)}, espressività ${band(traits.expressiveness)}.`,
    "Calma governa autocontrollo e stabilità emotiva; assertività chiarezza e fermezza; irruenza la rapidità nel chiedere la parola; empatia calore e attenzione sociale; sintesi la brevità; espressività varietà e intensità dei mood.",
  ].join(" ");
}

export function replyWordLimit(traits: AvatarCharacterTraits): number {
  return Math.round(42 - traits.concision * 0.24);
}

export function moodLevelGuidance(traits: AvatarCharacterTraits): string {
  const ordinaryMaximum = traits.expressiveness >= 75 && traits.calmness < 70
    ? 4
    : traits.expressiveness < 35 || traits.calmness >= 85
      ? 2
      : 3;
  return `Con calma ${traits.calmness} ed espressività ${traits.expressiveness}, usa normalmente level 1-${ordinaryMaximum}; level 4 solo per una reazione evidente e level 5 esclusivamente per un evento eccezionale.`;
}

export function autonomousInterventionCooldownMs(
  traits: AvatarCharacterTraits,
): number {
  const seconds = 60 + (traits.calmness - 50) * 0.7 - (traits.impulsiveness - 50) * 0.5;
  return Math.round(Math.max(45, Math.min(150, seconds))) * 1_000;
}
