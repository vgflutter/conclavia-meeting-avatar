/** Keep short replies together for prosody; prefetch longer answers by clause. */
export function splitMeetingSpeech(text: string, maximumLength = 280): string[] {
  const sentences = new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(text.trim());
  const chunks: string[] = [];
  let chunk = "";
  const append = (part: string) => {
    if (chunk && chunk.length + part.length + 1 > maximumLength) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk = chunk ? `${chunk} ${part}` : part;
  };
  for (const { segment } of sentences) {
    const sentence = segment.trim().replace(/\s+/gu, " ");
    if (!sentence) continue;
    if (sentence.length <= maximumLength) append(sentence);
    else {
      // Prefer punctuation over inserting a synthetic sentence end mid-clause.
      for (const clause of sentence.split(/(?<=[,;:])\s+/u)) {
        if (clause.length <= maximumLength) append(clause);
        else for (const word of clause.split(" ")) append(word);
      }
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function meetingSpeechLanguage(text: string, fallback: "it" | "en"): "it" | "en" {
  const words = text.toLowerCase().match(/[\p{L}’']+/gu) || [];
  const english = new Set(["the", "this", "that", "your", "you", "we", "will", "with", "have", "yes", "hello", "can", "is", "are", "was", "next", "approved", "remember"]);
  const italian = new Set(["il", "lo", "gli", "della", "delle", "che", "sono", "si", "sì", "puoi", "abbiamo", "questo", "questa", "una", "ciao", "prossimo", "approvato", "ricorda"]);
  const en = words.filter((word) => english.has(word)).length;
  const it = words.filter((word) => italian.has(word)).length;
  return en === it ? fallback : en > it ? "en" : "it";
}
