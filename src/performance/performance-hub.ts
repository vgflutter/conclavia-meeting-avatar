import type {
  PerformancePacket,
  PerformancePacketDraft,
} from "./performance-packet.js";

export interface PerformanceAudioAsset {
  id: string;
  bytes: Uint8Array;
  mimeType: "audio/wav";
  createdAt: string;
}

type PerformanceListener = (packet: PerformancePacket) => void;

export class PerformanceHub {
  readonly #packets: PerformancePacket[] = [];
  readonly #audio = new Map<string, PerformanceAudioAsset>();
  readonly #listeners = new Set<PerformanceListener>();
  readonly #maxPackets: number;
  #sequence = 0;

  constructor(maxPackets = 120) {
    this.#maxPackets = Math.max(10, maxPackets);
  }

  get listenerCount(): number {
    return this.#listeners.size;
  }

  get latestSequence(): number {
    return this.#sequence;
  }

  publish(
    draft: PerformancePacketDraft,
    audio?: PerformanceAudioAsset,
  ): PerformancePacket {
    const packet: PerformancePacket = {
      ...draft,
      sequence: ++this.#sequence,
    };
    this.#packets.push(packet);
    if (audio) this.#audio.set(audio.id, audio);
    while (this.#packets.length > this.#maxPackets) {
      const removed = this.#packets.shift();
      const assetId = removed?.audio?.assetId;
      if (assetId && !this.#packets.some((item) => item.audio?.assetId === assetId)) {
        this.#audio.delete(assetId);
      }
    }
    for (const listener of this.#listeners) listener(packet);
    return packet;
  }

  subscribe(listener: PerformanceListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  since(sequence: number): PerformancePacket[] {
    return this.#packets.filter((packet) => packet.sequence > sequence);
  }

  audioAsset(id: string): PerformanceAudioAsset | null {
    return this.#audio.get(id) ?? null;
  }

  clear(): void {
    this.#packets.length = 0;
    this.#audio.clear();
  }
}
