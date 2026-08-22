export interface DialogueLeaseSnapshot {
  active: boolean;
  speakerName: string | null;
  activeUntil: string | null;
  remainingFollowUps: number;
  maxFollowUps: number;
}

function normalizeParticipant(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .trim()
    .toLocaleLowerCase();
}

/**
 * Owns the short conversational right that follows an explicit invocation.
 * The lease is deliberately tied to one speaker: a room full of people can
 * keep talking without accidentally extending somebody else's dialogue.
 */
export class DialogueLease {
  readonly #timeoutMs: number;
  readonly #maxFollowUps: number;
  #speakerName: string | null = null;
  #participantKey: string | null = null;
  #expiresAt = 0;
  #remainingFollowUps = 0;

  constructor(timeoutMs: number, maxFollowUps = 2) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 10_000) {
      throw new Error("Dialogue lease timeout must be at least 10000 ms");
    }
    if (!Number.isInteger(maxFollowUps) || maxFollowUps < 1 || maxFollowUps > 5) {
      throw new Error("Dialogue lease follow-ups must be between 1 and 5");
    }
    this.#timeoutMs = timeoutMs;
    this.#maxFollowUps = maxFollowUps;
  }

  open(participantKey: string, speakerName: string, now = Date.now()): void {
    const cleanKey = normalizeParticipant(participantKey);
    const cleanName = speakerName.trim();
    if (!cleanKey || !cleanName) {
      this.close();
      return;
    }
    this.#speakerName = cleanName;
    this.#participantKey = cleanKey;
    this.#remainingFollowUps = this.#maxFollowUps;
    this.#expiresAt = now + this.#timeoutMs;
  }

  isActiveFor(participantKey: string, now = Date.now()): boolean {
    this.#expire(now);
    return this.#participantKey !== null &&
      this.#participantKey === normalizeParticipant(participantKey) &&
      this.#remainingFollowUps > 0;
  }

  consumeFollowUp(participantKey: string, now = Date.now()): boolean {
    if (!this.isActiveFor(participantKey, now)) return false;
    this.#remainingFollowUps -= 1;
    if (this.#remainingFollowUps === 0) {
      this.close();
    } else {
      this.#expiresAt = now + this.#timeoutMs;
    }
    return true;
  }

  close(): void {
    this.#speakerName = null;
    this.#participantKey = null;
    this.#expiresAt = 0;
    this.#remainingFollowUps = 0;
  }

  snapshot(now = Date.now()): DialogueLeaseSnapshot {
    this.#expire(now);
    return {
      active: this.#participantKey !== null,
      speakerName: this.#speakerName,
      activeUntil: this.#participantKey === null
        ? null
        : new Date(this.#expiresAt).toISOString(),
      remainingFollowUps: this.#remainingFollowUps,
      maxFollowUps: this.#maxFollowUps,
    };
  }

  #expire(now: number): void {
    if (this.#participantKey !== null && now >= this.#expiresAt) this.close();
  }
}
