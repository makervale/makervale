/** Which chat lines are new since the last render, and how each one looks. */
import type { ChatLine } from "@/net/state";

/** lines fade away after this long; hovering the chat or typing shows them again */
export const FADE_AFTER_MS = 30_000;
/** the most lines kept in the overlay */
export const MAX_SHOWN = 200;

export type LineKind = "sys" | "me" | "obj" | "them";

export function lineKind(line: ChatLine): LineKind {
  if (line.system) return "sys";
  if (line.self) return "me";
  if (line.obj) return "obj";
  return "them";
}

export const isOld = (at: number, now: number): boolean => now - at > FADE_AFTER_MS;

export interface Unseen {
  /** the shown lines no longer match the chat (it was cleared, or the last shown line scrolled out): start over */
  reset: boolean;
  lines: readonly ChatLine[];
}

/**
 * The lines after the last one shown. Tracked by identity rather than by count, because the chat drops its oldest
 * line once it is full: the count stays the same while new lines keep coming.
 */
export function unseenLines(chat: readonly ChatLine[], lastShown: ChatLine | null): Unseen {
  if (!lastShown) return { reset: false, lines: chat };
  const i = chat.lastIndexOf(lastShown);
  if (i < 0) return { reset: true, lines: chat };
  return { reset: false, lines: chat.slice(i + 1) };
}
