import { pathToFileURL } from "node:url";

class EntryDiagnosticError extends Error {}

export async function diagnoseEntry(meetingId, { origin = "http://127.0.0.1:3000", fetcher = fetch } = {}) {
  if (!/^[a-f0-9]{24}$/i.test(meetingId || "")) throw new Error("Provide one valid meeting ID.");
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error("Loopback origin required.");
  const response = await fetcher(`${url.origin}/api/meetings/${meetingId}/diagnostics`, {
    method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new EntryDiagnosticError(response.status === 404
    ? "Meeting non trovato: potrebbe essere stato eliminato. Usa l’ID di un meeting presente nella GUI."
    : `Diagnostica locale: HTTP ${response.status}.`);
  return response.json();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error("Invalid arguments");
    console.log(JSON.stringify(await diagnoseEntry(process.argv[2]), null, 2));
  } catch (error) {
    if (error instanceof EntryDiagnosticError) console.error(error.message);
    console.error("Diagnostica non disponibile. Usa npm run diagnose:entry -- <meeting-id> con l’app locale attiva. Nessun bot è stato avviato o modificato.");
    process.exitCode = 1;
  }
}
