/** Per-process bounds; production ingress must also enforce authenticated tenant quotas. */
export function createSpeechRequestLimiter(now: () => number = Date.now) {
  const limits = new Map<string, { count: number; until: number; activeUntil: number }>();
  return (key: string): (() => void) | undefined => {
    const time = now();
    for (const [id, item] of limits) if (item.until <= time && item.activeUntil <= time) limits.delete(id);
    if (limits.size >= 1_000 && !limits.has(key)) return;
    const current = limits.get(key) || { count: 0, until: time + 60_000, activeUntil: 0 };
    if (current.until <= time) { current.count = 0; current.until = time + 60_000; }
    if (current.activeUntil > time || current.count >= 12) return;
    if ([...limits.values()].filter((item) => item.activeUntil > time).length >= 4) return;
    current.count++;
    current.activeUntil = time + 95_000;
    limits.set(key, current);
    return () => { current.activeUntil = 0; };
  };
}

const claim = createSpeechRequestLimiter();

export async function limitedSpeechResponse(key: string, create: () => Promise<Response>): Promise<Response> {
  const release = claim(key);
  if (!release) return Response.json({ error: "Voice busy. Try again shortly." }, { status: 429, headers: { "Retry-After": "5" } });
  try {
    const response = await create();
    if (!response.body) { release(); return response; }
    const reader = response.body.getReader();
    return new Response(new ReadableStream({
      async pull(output) {
        try {
          const chunk = await reader.read();
          if (chunk.done) { release(); output.close(); }
          else output.enqueue(chunk.value);
        } catch { release(); output.error(new Error("Speech interrupted")); }
      },
      async cancel() { release(); await reader.cancel(); },
    }), { status: response.status, headers: response.headers });
  } catch (error) { release(); throw error; }
}
