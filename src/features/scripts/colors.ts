const NAMED: Record<string, string> = {
  red: "#e03c2f",
  green: "#3fbf3f",
  blue: "#3f7fe0",
  white: "#ffffff",
  black: "#111111",
  yellow: "#f5d33b",
  orange: "#f08a24",
  purple: "#8e44ad",
  pink: "#f28cb1",
  gray: "#888888",
  grey: "#888888",
  brown: "#8b5a2b",
  cyan: "#4dd1ff",
};

/** "#rrggbb", "#rgb" or a colour name → "#rrggbb", or null */
export function parseColor(text: string): string | null {
  const c = text.trim().toLowerCase();
  if (NAMED[c]) return NAMED[c];
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) return "#" + [...c.slice(1)].map((x) => x + x).join("");
  return null;
}
