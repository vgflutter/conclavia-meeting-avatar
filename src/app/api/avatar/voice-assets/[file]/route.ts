// Retired synthesis endpoint. Never fetch or redirect to browser model assets.
export function GET() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}
