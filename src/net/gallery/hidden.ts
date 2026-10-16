/** Worlds and authors you hid from your Gallery: only in this browser, nobody else is affected or told. */
import type { WorldHead } from "./model";

const STORE_KEY = "mv.hidden";

interface Hidden {
  worlds: string[];
  authors: string[];
}

function read(): Hidden {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);
    return { worlds: list(d.worlds), authors: list(d.authors) };
  } catch {
    return { worlds: [], authors: [] };
  }
}

function write(h: Hidden): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(h));
  } catch {
    // hiding lasts for this visit only
  }
}

const worldKey = (h: WorldHead) => h.author + ":" + h.id;

export function isHidden(h: WorldHead): boolean {
  const hidden = read();
  return hidden.authors.includes(h.author) || hidden.worlds.includes(worldKey(h));
}

export function hideWorld(h: WorldHead): void {
  const hidden = read();
  write({ ...hidden, worlds: [...hidden.worlds, worldKey(h)].slice(-1000) });
}

export function hideAuthor(author: string): void {
  const hidden = read();
  write({ ...hidden, authors: [...hidden.authors, author].slice(-1000) });
}

export const unhideAll = (): void => write({ worlds: [], authors: [] });
