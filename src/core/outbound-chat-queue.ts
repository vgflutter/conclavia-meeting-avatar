import type { ChatPlatform, OutboundChatMessage } from "../domain/protocol.js";

interface QueuedMessage {
  message: OutboundChatMessage;
  leasedUntil: number;
}

function queueKey(platform: ChatPlatform, meetingId: string): string {
  return `${platform}\u0000${meetingId}`;
}

export class OutboundChatQueue {
  readonly #queues = new Map<string, QueuedMessage[]>();

  enqueue(message: OutboundChatMessage): void {
    const key = queueKey(message.platform, message.meetingId);
    const queue = this.#queues.get(key) ?? [];
    const supersededIndex = queue.findIndex((entry) =>
      entry.message.replyToMessageId === message.replyToMessageId
    );
    if (supersededIndex >= 0) queue.splice(supersededIndex, 1);
    queue.push({ message, leasedUntil: 0 });
    if (queue.length > 100) queue.splice(0, queue.length - 100);
    this.#queues.set(key, queue);
  }

  lease(
    platform: ChatPlatform,
    meetingId: string,
    now = Date.now(),
    leaseMs = 15_000,
  ): OutboundChatMessage[] {
    const queue = this.#queues.get(queueKey(platform, meetingId)) ?? [];
    const available = queue.filter((entry) => entry.leasedUntil <= now).slice(0, 10);
    for (const entry of available) entry.leasedUntil = now + leaseMs;
    return available.map((entry) => ({ ...entry.message }));
  }

  acknowledge(platform: ChatPlatform, meetingId: string, messageIds: readonly string[]): number {
    const key = queueKey(platform, meetingId);
    const queue = this.#queues.get(key) ?? [];
    const acknowledged = new Set(messageIds);
    const remaining = queue.filter((entry) => !acknowledged.has(entry.message.id));
    if (remaining.length) this.#queues.set(key, remaining);
    else this.#queues.delete(key);
    return queue.length - remaining.length;
  }

  clear(): void {
    this.#queues.clear();
  }
}
