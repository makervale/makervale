/**
 * Per-viewer conveniences kept in browser storage: pinned tools ("At hand") and recently used ones.
 * The Build window shows the pins too; main.ts hands it this object as its pins port.
 */
const DEFAULT_PINS = ["extrude", "inset", "loopcut", "merge", "connect", "subdivide", "mirror"];
const RECENT_MAX = 12;
const PINS_KEY = "pias.pins";
const RECENT_KEY = "pias.recent";

/** the part of `localStorage` used here; tests pass a map */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function read<T>(storage: KeyValue | null, key: string, fallback: T): T {
  try {
    const v = storage?.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(storage: KeyValue | null, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the change lasts until reload */
  }
}

export function browserStorage(): KeyValue | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export class Prefs {
  pinned: string[];
  recent: string[];
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: KeyValue | null = browserStorage()) {
    this.pinned = read(storage, PINS_KEY, DEFAULT_PINS.slice());
    this.recent = read<string[]>(storage, RECENT_KEY, []);
  }

  pins(): string[] {
    return this.pinned;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  togglePin(id: string): void {
    const i = this.pinned.indexOf(id);
    if (i >= 0) this.pinned.splice(i, 1);
    else this.pinned.push(id);
    this.savePins();
  }

  resetPins(): void {
    this.pinned = DEFAULT_PINS.slice();
    this.savePins();
  }

  noteUsed(id: string): void {
    this.recent = [id, ...this.recent.filter((x) => x !== id)].slice(0, RECENT_MAX);
    write(this.storage, RECENT_KEY, this.recent);
  }

  private savePins(): void {
    write(this.storage, PINS_KEY, this.pinned);
    for (const listener of this.listeners) listener();
  }
}
