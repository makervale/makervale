/** a speech bubble holds this many lines; longer speech ends with … (the chat has all of it) */
export const MAX_LINES = 8;

/** break text into lines no wider than `width`; words too long for a line (links) are broken too */
export function wrapText(text: string, width: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).flatMap((w) => splitLongWord(w, width, measure));
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) > width && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
    if (lines.length === MAX_LINES) break;
  }
  if (lines.length < MAX_LINES && line) lines.push(line);
  const cut = lines.join(" ").length < words.join(" ").length;
  if (cut) lines[lines.length - 1] = lines[lines.length - 1].replace(/.{0,2}$/, "…");
  return lines;
}

function splitLongWord(word: string, width: number, measure: (s: string) => number): string[] {
  if (measure(word) <= width) return [word];
  const parts: string[] = [];
  let part = "";
  for (const ch of word) {
    if (part && measure(part + ch) > width) {
      parts.push(part);
      part = "";
    }
    part += ch;
  }
  return part ? [...parts, part] : parts;
}
