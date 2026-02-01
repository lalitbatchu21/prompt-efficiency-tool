const STOP_WORD_REGEX = /\b(the|a|an|is)\b/gi;
const CODE_SEGMENT_REGEX = /```[\s\S]*?```|`[^`]*`/g;

function stripStopWords(segment: string): string {
  const withoutStops = segment.replace(STOP_WORD_REGEX, "");
  return withoutStops.replace(/\s{2,}/g, " ");
}

export function compressPrompt(text: string): string {
  let result = "";
  let lastIndex = 0;

  for (const match of text.matchAll(CODE_SEGMENT_REGEX)) {
    const index = match.index ?? 0;
    const before = text.slice(lastIndex, index);
    result += stripStopWords(before);
    result += match[0];
    lastIndex = index + match[0].length;
  }

  result += stripStopWords(text.slice(lastIndex));
  return result.trim();
}
