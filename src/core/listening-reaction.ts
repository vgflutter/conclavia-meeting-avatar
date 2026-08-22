import type {
  AvatarListeningReaction,
  AvatarMood,
  AvatarMoodLevel,
} from "../domain/protocol.js";

export interface StableListeningReaction extends AvatarListeningReaction {
  holdMs: number;
}

export interface ListeningReactionSnapshot {
  mood: AvatarMood;
  level: AvatarMoodLevel;
  appliedAt: string | null;
  holdUntil: string | null;
}

const minimumRepeatMs = 3_000;

function holdDurationMs(level: AvatarMoodLevel): number {
  return 3_800 + level * 1_100;
}

/**
 * Prevents sentence-by-sentence emotion flicker in a live meeting.
 * Strong reactions may replace a held pose; ordinary reactions wait until the
 * current social signal has had enough time to read on camera.
 */
export class ListeningReactionStabilizer {
  #mood: AvatarMood = "attentive";
  #level: AvatarMoodLevel = 1;
  #appliedAt = 0;
  #holdUntil = 0;

  consider(
    candidate: AvatarListeningReaction,
    now = Date.now(),
  ): StableListeningReaction | null {
    const sameMood = candidate.mood === this.#mood;
    const stronger = candidate.level >= Math.min(5, this.#level + 2);

    if (sameMood && now - this.#appliedAt < minimumRepeatMs) return null;
    if (!sameMood && now < this.#holdUntil && !stronger) return null;

    const holdMs = holdDurationMs(candidate.level);
    this.#mood = candidate.mood;
    this.#level = candidate.level;
    this.#appliedAt = now;
    this.#holdUntil = now + holdMs;
    return { ...candidate, holdMs };
  }

  get snapshot(): ListeningReactionSnapshot {
    return {
      mood: this.#mood,
      level: this.#level,
      appliedAt: this.#appliedAt ? new Date(this.#appliedAt).toISOString() : null,
      holdUntil: this.#holdUntil ? new Date(this.#holdUntil).toISOString() : null,
    };
  }
}
