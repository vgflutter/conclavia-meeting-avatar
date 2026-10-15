/** Management APIs stay private; reject browser requests from another origin. */
export function podcastMutationIsSameOrigin(request: Request): boolean {
  if (["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") || "")) return false;
  try {
    const destination = new URL(request.url);
    const host = request.headers.get("host");
    if (host) destination.host = host;
    const origin = request.headers.get("origin");
    return !origin || origin === destination.origin;
  } catch {
    return false;
  }
}

export class PodcastRequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "PodcastRequestError";
  }
}

/** Bound bytes while reading, including chunked requests without Content-Length. */
export async function readPodcastJson(request: Request, maxBytes = 40_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new PodcastRequestError("Request body must be JSON");
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) throw new PodcastRequestError("Request body is too large", 413);
  if (!request.body) throw new PodcastRequestError("Request body is required");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PodcastRequestError("Request body is too large", 413);
      }
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof PodcastRequestError) throw error;
    throw new PodcastRequestError("Request body must be valid JSON");
  } finally {
    reader.releaseLock();
  }
}
