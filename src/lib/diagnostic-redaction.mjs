// Shared by the server and local launcher. Never persist raw payloads/headers.
export function sanitizeDiagnosticText(value) {
  if (typeof value !== "string") return "[non-text diagnostic omitted]";
  if (value.length > 32768) return "[oversized diagnostic omitted]";
  let text = value.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  // Payload dumps can contain arbitrary conversation or credentials. Keep only
  // the preceding error label, not a purportedly safe subset of the payload.
  text = text.replace(/\b(?:payload|transcript|transcription|prompt|context|request body|response body|headers|environment)["']?\s*[:=][\s\S]*/gi, "[payload omitted]");
  text = text.replace(/-----BEGIN [^-]+-----[\s\S]*/g, "[key material omitted]");
  text = text.replace(/\b(?:authorization|proxy-authorization|cookie|set-cookie)\b["']?\s*[:=][^\r\n]*/gi, "[credentials omitted]");
  text = text.replace(/\b(?:Bearer|Basic|Token)\s+[^\s,;"']+/gi, "[credential omitted]");
  text = text.replace(/\b(?:[\w-]*(?:password|passwd|secret|token|api[_-]?key|credential)[\w-]*|pwd|passcode)\b["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, "[credential omitted]");
  text = text.replace(/\b(?:https?|wss?|mongodb(?:\+srv)?):\/\/[^\s<>"']+/gi, "[URL omitted]");
  text = text.replace(/\/(?:api\/)?meeting-room\/[^\s<>"']+/gi, "/meeting-room/[capability omitted]");
  text = text.replace(/(\/api\/meetings\/[a-f0-9]{24})(?=\/|\s|\?|$)/gi, match => match.replace(/([a-f0-9]{24})$/i, "[meeting-id]"));
  text = text.replace(/[?&][^\s<>"']+/g, "[query omitted]");
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email omitted]");
  text = text.replace(/\/(?:Users|home)\/[^\s<>"']+/g, "[local path omitted]");
  text = text.replace(/\b[A-Za-z0-9_+/=-]{32,}\b/g, "[opaque value omitted]");
  // JSONL records remain a single line; no terminal/control-sequence injection.
  return text.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 2048);
}
