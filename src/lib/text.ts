const TAB = 9;
const NEWLINE = 10;
const FIRST_PRINTABLE = 32;

/** drop control characters; `keepLines` keeps tabs and newlines (for script source) */
export function stripControl(s: string, keepLines = false): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= FIRST_PRINTABLE || (keepLines && (code === TAB || code === NEWLINE))) out += ch;
  }
  return out;
}
