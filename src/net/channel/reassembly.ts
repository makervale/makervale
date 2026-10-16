/** Putting a long message back together from the parts it was cut into (outbox.ts), whatever order they arrive in. */
import { readPart } from "./outbox";

/** parts of a message still missing after this long are dropped */
const KEEP_MS = 30_000;
const MAX_PENDING = 32;

interface Pending {
  parts: (string | undefined)[];
  have: number;
  at: number;
}

export class Reassembly {
  private pending = new Map<string, Pending>();

  /** the whole payload once complete (or at once, if it wasn't cut); null while parts are missing. Parts are kept
   *  per sender, so nobody can slip a part into someone else's message. */
  add(content: string, sender: string): string | null {
    const part = readPart(content);
    if (!part) return content;
    this.expire();
    const key = sender + ":" + part.id;
    let p = this.pending.get(key);
    if (!p) {
      if (this.pending.size >= MAX_PENDING) return null;
      p = { parts: new Array(part.n), have: 0, at: Date.now() };
      this.pending.set(key, p);
    }
    if (p.parts.length !== part.n || p.parts[part.i] !== undefined) return null;
    p.parts[part.i] = part.body;
    if (++p.have < part.n) return null;
    this.pending.delete(key);
    return p.parts.join("");
  }

  private expire(): void {
    const old = Date.now() - KEEP_MS;
    for (const [id, p] of this.pending) if (p.at < old) this.pending.delete(id);
  }
}
