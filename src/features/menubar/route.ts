/** Where a menu command goes: a tool, a window, the sky, another feature (over the bus), or the menu bar itself. */
export type SkyMode = "day" | "sunset" | "night" | "cycle";

const LOCAL = ["undo", "redo", "del", "desel", "focussel", "home", "search", "wire", "sand", "about"] as const;
export type LocalCommand = (typeof LOCAL)[number];

/** handled by other features through "menu:command" (files, Tools panel) */
const ELSEWHERE = new Set(["new", "open", "save", "export", "sample", "catalog", "sound"]);
const SKY = new Set<string>(["day", "sunset", "night", "cycle"]);

export type Route =
  | { kind: "tool"; id: string }
  | { kind: "window"; id: string }
  | { kind: "sky"; mode: SkyMode }
  | { kind: "feature"; command: string }
  | { kind: "local"; name: LocalCommand }
  | { kind: "unknown" };

export function route(command: string): Route {
  const [prefix, rest] = command.split(/:(.*)/s);
  if (rest !== undefined && prefix === "tool") return { kind: "tool", id: rest };
  if (rest !== undefined && prefix === "win") return { kind: "window", id: rest };
  if (rest !== undefined && prefix === "time" && SKY.has(rest)) return { kind: "sky", mode: rest as SkyMode };
  if (ELSEWHERE.has(command)) return { kind: "feature", command };
  if ((LOCAL as readonly string[]).includes(command)) return { kind: "local", name: command as LocalCommand };
  return { kind: "unknown" };
}

export const SKY_NOTE: Record<SkyMode, string> = {
  day: "Midday",
  sunset: "Sunset",
  night: "Night: glowing things light up",
  cycle: "A full day every 20 minutes",
};
