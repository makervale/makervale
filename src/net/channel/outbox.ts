/**
 * What waits to go through the relay channel. Messages are gathered for a moment and leave together, as one sealed
 * event: relays limit how often a connection may publish. Streams where only the latest value matters (avatars,
 * drags, rolling balls) keep just their latest message per destination.
 */

/** one message through the relays: from whom, to whom (empty: everyone), which action, its data as JSON */
export interface Envelope {
  o: string;
  t: string[];
  n: string;
  j: string;
  /** message id */
  m: string;
}

/** only the latest of these matters */
export const LATEST_ONLY = new Set(["av", "xf", "body", "_here"]);

export class Outbox {
  private queue: Envelope[] = [];
  private latest = new Map<string, number>();

  get size(): number {
    return this.queue.length;
  }

  add(env: Envelope): void {
    if (!LATEST_ONLY.has(env.n)) {
      this.queue.push(env);
      return;
    }
    const key = env.n + "|" + env.t.join(",");
    const at = this.latest.get(key);
    if (at === undefined) {
      this.latest.set(key, this.queue.length);
      this.queue.push(env);
    } else this.queue[at] = env;
  }

  /** everything waiting, in order; the outbox is empty after */
  take(): Envelope[] {
    const out = this.queue;
    this.queue = [];
    this.latest.clear();
    return out;
  }
}

/** a long payload cut into numbered parts, each small enough for one event */
export function cutParts(text: string, size: number, id: string): string[] {
  if (text.length <= size) return [text];
  const n = Math.ceil(text.length / size);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(`${id}:${i}:${n}:` + text.slice(i * size, (i + 1) * size));
  return out;
}

const PART = /^([\w]{1,24}):(\d{1,4}):(\d{1,4}):/;

export interface Part {
  id: string;
  i: number;
  n: number;
  body: string;
}

/** a part made by cutParts, or null for a whole payload */
export function readPart(text: string): Part | null {
  const m = PART.exec(text);
  if (!m) return null;
  const i = +m[2];
  const n = +m[3];
  return i < n ? { id: m[1], i, n, body: text.slice(m[0].length) } : null;
}
