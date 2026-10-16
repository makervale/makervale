/** Checking what came through the relay channel before anything acts on it: shape, sizes, ids. */
import type { Envelope } from "./outbox";

const MAX_ENVELOPES = 200;
const ID = /^[\w-]{1,64}$/;
const NAME = /^_?[a-z]{1,8}$/;
const MAX_JSON = 32 * 1024 * 1024;
const MAX_TARGETS = 64;

const isId = (x: unknown): x is string => typeof x === "string" && ID.test(x);
const isName = (x: unknown): x is string => typeof x === "string" && NAME.test(x);
const isJson = (x: unknown): x is string => typeof x === "string" && x.length <= MAX_JSON;
const isTargets = (x: unknown): x is string[] => Array.isArray(x) && x.length <= MAX_TARGETS && x.every(isId);

function readEnvelope(x: unknown): Envelope | null {
  if (!x || typeof x !== "object") return null;
  const e = x as Record<string, unknown>;
  if (!isId(e.o) || !isName(e.n) || !isJson(e.j) || !isId(e.m) || !isTargets(e.t)) return null;
  return { o: e.o, t: e.t, n: e.n, j: e.j, m: e.m };
}

/** the envelopes of a batch (the unpacked, unsealed content of a channel event) */
export function readBatch(x: unknown): Envelope[] {
  if (!x || typeof x !== "object" || (x as { v?: unknown }).v !== 1) return [];
  const list = (x as { e?: unknown }).e;
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, MAX_ENVELOPES)
    .map(readEnvelope)
    .filter((e): e is Envelope => e !== null);
}
