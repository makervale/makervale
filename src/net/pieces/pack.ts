/**
 * Cutting a scene into pieces for the relays, so that a change re-sends only what changed. Objects are grouped into
 * buckets by their ids: a bucket ends after every object whose id hashes to a multiple of BUCKET_EVERY, so editing,
 * adding or deleting an object changes one bucket (two at most), never shifts the others. Each bucket is packed
 * (JSON, deflated) and cut into pieces small enough for one Nostr event.
 */
import type { Obj } from "@/world/model";
import { pack } from "../seal";

/** about this many objects per bucket */
export const BUCKET_EVERY = 8;
/** bytes of packed scene per piece (sealed and base64-encoded, an event stays under ~42 kB) */
export const PIECE_BYTES = 30_000;

/** FNV-1a: a cheap, stable hash of an id */
function idHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function byId(a: Obj, b: Obj): number {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** the scene's objects in buckets whose borders only depend on the ids */
export function bucketObjects(objects: readonly Obj[]): Obj[][] {
  const out: Obj[][] = [];
  let bucket: Obj[] = [];
  for (const o of [...objects].sort(byId)) {
    bucket.push(o);
    if (idHash(o.id) % BUCKET_EVERY === 0) {
      out.push(bucket);
      bucket = [];
    }
  }
  if (bucket.length) out.push(bucket);
  return out;
}

/** a bucket as packed bytes, cut into pieces */
export function piecesOf(bucket: Obj[]): Uint8Array[] {
  const bytes = pack(bucket);
  const out: Uint8Array[] = [];
  for (let at = 0; at < bytes.length; at += PIECE_BYTES) out.push(bytes.slice(at, at + PIECE_BYTES));
  return out;
}

/** pieces back into one run of bytes */
export function joinPieces(pieces: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of pieces) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** put objects in the scene's order; objects the order doesn't name go last */
export function inOrder(objects: Obj[], order: readonly string[]): Obj[] {
  const at = new Map(order.map((id, i) => [id, i]));
  const rank = (o: Obj) => at.get(o.id) ?? order.length;
  return [...objects].sort((a, b) => rank(a) - rank(b));
}
