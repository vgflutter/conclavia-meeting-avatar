/** Navigate to the existing service. No session, credentials or context is transferred. */
export async function GET(request: Request) {
  const hostname = new URL(request.url).hostname;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  const fallback = local ? "http://127.0.0.1:3002/studio" : "https://onboarding.conclavia.me/studio";
  const configured = process.env.CONCLAVIA_ONBOARDING_STUDIO_URL;
  let target: URL;
  try {
    target = new URL(configured || fallback);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || target.hash) throw new Error("Invalid studio URL");
  } catch {
    return Response.json({ error: "Onboarding Studio address is not configured correctly" }, { status: 503 });
  }
  return Response.redirect(target, 307);
}
