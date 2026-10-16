/**
 * A scene as pieces on the relays, for a private room's copy (vault/) and for worlds in the Gallery (gallery/).
 * Writing sends only the pieces the relays don't have yet, one after the other so no relay feels flooded; if one
 * reaches no relay, the write fails and whatever pointed to the old pieces stays as it was. Reading fetches pieces by
 * hash and checks each one; a scene with a piece missing is not used.
 */
import type { Obj, World } from "@/world/model";
import type { NostrEvent } from "../nostr";
import { APP_DATA_KIND, eventTag, nowSeconds, signedEventBy } from "../nostr";
import type { QueryResult } from "../relay-query";
import { publishEvent, queryRelaysDetailed } from "../relay-query";
import { sanitizeObjects } from "../sanitize";
import { fromBase64, hashHex, toBase64, unpack } from "../seal";
import type { Codec } from "./codec";
import { bucketObjects, inOrder, joinPieces, piecesOf } from "./pack";

export const pieceTag = (hash: string): string => "b:" + hash;
/** a piece older than this is published again on the next write, so it doesn't expire */
export const REFRESH_AFTER_S = 60 * 86_400;
const MAX_OBJECTS = 5000;
const TAGS_PER_QUERY = 100;
const PACE_MS = 120;

/** what a query saw: events, which relay sent which, and which relays answered in full (for read-repair) */
export type Sightings = QueryResult;

export interface StoredPiece {
  hash: string;
  bytes: Uint8Array;
}

/** what the scene is made of, beside its pieces: enough to put it back together */
export interface SceneIndex {
  seq: number;
  order: string[];
  buckets: string[][];
}

const known = new Map<string, Map<string, number>>();

export function knownPieces(scope: string): Map<string, number> {
  let m = known.get(scope);
  if (!m) known.set(scope, (m = new Map()));
  return m;
}

const pause = () => new Promise((r) => setTimeout(r, PACE_MS));

export function pieceEvent(piece: StoredPiece, secret: Uint8Array, ttlS: number | null): Promise<NostrEvent> {
  const tags = [["d", pieceTag(piece.hash)]];
  if (ttlS) tags.push(["expiration", String(nowSeconds() + ttlS)]);
  return signedEventBy(secret, APP_DATA_KIND, tags, toBase64(piece.bytes));
}

async function encodeScene(codec: Codec, world: World): Promise<StoredPiece[][]> {
  const out: StoredPiece[][] = [];
  for (const bucket of bucketObjects(world.objects)) {
    const pieces = await Promise.all(piecesOf(bucket).map((p) => codec.encode(p)));
    out.push(await Promise.all(pieces.map(async (bytes) => ({ hash: await hashHex(bytes), bytes }))));
  }
  return out;
}

export interface WriteOptions {
  signer: Uint8Array;
  /** seconds until the relays may drop a piece; null: never */
  ttlS: number | null;
}

/** the scene's index once all its pieces are on the relays; null if a piece reached nobody */
export async function writeScene(codec: Codec, world: World, opts: WriteOptions): Promise<SceneIndex | null> {
  const buckets = await encodeScene(codec, world);
  const have = knownPieces(codec.scope);
  const stale = nowSeconds() - REFRESH_AFTER_S;
  let sent = 0;
  for (const p of buckets.flat()) {
    if ((have.get(p.hash) ?? 0) > stale) continue;
    if (sent++) await pause();
    if (!(await publishEvent(await pieceEvent(p, opts.signer, opts.ttlS)))) return null;
    have.set(p.hash, nowSeconds());
  }
  const order = world.objects.map((o) => o.id);
  return { seq: world.seq, order, buckets: buckets.map((b) => b.map((p) => p.hash)) };
}

async function openPiece(codec: Codec, ev: NostrEvent): Promise<StoredPiece | null> {
  const tag = eventTag(ev, "d");
  const bytes = tag.startsWith("b:") ? fromBase64(ev.content) : null;
  if (!bytes || (await hashHex(bytes)) !== tag.slice(2)) return null;
  const plain = await codec.decode(bytes);
  return plain ? { hash: tag.slice(2), bytes: plain } : null;
}

/** what several queries saw together: a relay counts as answered only if it answered all of them */
export function mergeSightings(a: Sightings, b: Sightings): Sightings {
  const holders = new Map(a.holders);
  for (const [id, urls] of b.holders) holders.set(id, new Set([...(holders.get(id) ?? []), ...urls]));
  const answered = new Set([...a.answered].filter((u) => b.answered.has(u)));
  return { events: [...a.events, ...b.events], holders, answered };
}

interface Fetched {
  plain: Map<string, Uint8Array>;
  seen: Sightings;
}

async function fetchPieces(codec: Codec, author: string, hashes: string[], seen: Sightings): Promise<Fetched> {
  const plain = new Map<string, Uint8Array>();
  const have = knownPieces(codec.scope);
  for (let i = 0; i < hashes.length; i += TAGS_PER_QUERY) {
    const tags = hashes.slice(i, i + TAGS_PER_QUERY).map(pieceTag);
    const found = await queryRelaysDetailed([{ kinds: [APP_DATA_KIND], authors: [author], "#d": tags }]);
    const used: NostrEvent[] = [];
    for (const ev of found.events) {
      const piece = await openPiece(codec, ev);
      if (!piece || plain.has(piece.hash)) continue;
      plain.set(piece.hash, piece.bytes);
      used.push(ev);
      have.set(piece.hash, Math.max(have.get(piece.hash) ?? 0, ev.created_at));
    }
    seen = mergeSightings(seen, { ...found, events: used });
  }
  return { plain, seen };
}

function assemble(index: SceneIndex, pieces: Map<string, Uint8Array>): World | null {
  const objects: Obj[] = [];
  for (const bucket of index.buckets) {
    const parts = bucket.map((h) => pieces.get(h));
    if (parts.some((p) => !p)) return null;
    objects.push(...sanitizeObjects(unpack(joinPieces(parts as Uint8Array[])), MAX_OBJECTS));
  }
  return { seq: index.seq, objects: inOrder(objects, index.order).slice(0, MAX_OBJECTS) };
}

export interface ReadScene {
  world: World;
  seen: Sightings;
}

/** the scene, or null if any piece is missing; `seen` starts with what found the index */
export async function readScene(
  codec: Codec,
  author: string,
  index: SceneIndex,
  seen: Sightings,
): Promise<ReadScene | null> {
  const fetched = await fetchPieces(codec, author, index.buckets.flat(), seen);
  const world = assemble(index, fetched.plain);
  return world ? { world, seen: fetched.seen } : null;
}
