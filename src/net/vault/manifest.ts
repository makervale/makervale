/**
 * The manifest: the one small, replaceable event that says what a private room's copy on the relays is (its name,
 * version, when it was saved, its rules) and which pieces make up its scene. Where only the owner builds, only the
 * owner may save the copy: the manifest then carries the owner's signature, so nobody else who knows the code can
 * forge it. It goes out under the owner's key as well as the room's, so it can't be buried under fakes either.
 */
import { checkRules } from "@/lib/rules";
import type { Rules } from "@/lib/rules";
import { signText, verifyText } from "../nostr";
import type { SceneIndex } from "../pieces/scene";
import { asRecord, cleanList, cleanNum, cleanText, validId } from "../sanitize";

export interface Manifest {
  v: 2;
  name: string;
  ver: number;
  /** ms */
  at: number;
  rules: Rules;
  scene: SceneIndex;
  osig?: string;
}

export const MANIFEST_TAG = "m";
const MAX_COUNTER = 1e12;
const MAX_OBJECTS = 5000;
const MAX_BUCKETS = 5000;
const MAX_PIECES = 400;
const HASH = /^[0-9a-f]{64}$/;

/** JSON with keys sorted at every level: the same value always gives the same text */
export function canonicalJson(x: unknown): string {
  if (Array.isArray(x)) return "[" + x.map(canonicalJson).join(",") + "]";
  if (x && typeof x === "object") {
    const entries = Object.entries(x as Record<string, unknown>).filter(([, v]) => v !== undefined);
    entries.sort(([a], [b]) => (a < b ? -1 : 1));
    return "{" + entries.map(([k, v]) => JSON.stringify(k) + ":" + canonicalJson(v)).join(",") + "}";
  }
  return JSON.stringify(x);
}

const signedPart = (m: Record<string, unknown>): string => canonicalJson({ ...m, osig: undefined });

export const ownerOnly = (rules: Rules | null): boolean => rules?.build === "owner";

export const ownerSigned = (m: Manifest, ownerSecret: Uint8Array): Manifest => ({
  ...m,
  osig: signText(signedPart({ ...m }), ownerSecret),
});

function cleanScene(x: unknown): SceneIndex | null {
  const d = asRecord(x);
  const buckets = cleanList(d.buckets, MAX_BUCKETS).map((b) => cleanList(b, MAX_PIECES));
  if (!buckets.every((b) => b.length > 0 && b.every((h) => typeof h === "string" && HASH.test(h)))) return null;
  const order = cleanList(d.order, MAX_OBJECTS).filter(validId);
  return { seq: Math.floor(cleanNum(d.seq, 1, MAX_COUNTER) ?? 1), order, buckets: buckets as string[][] };
}

/** a manifest from a relay, checked: its shape, its rules' signature and, where only the owner builds, its owner */
export async function readManifest(raw: unknown, room: string): Promise<Manifest | null> {
  const d = asRecord(raw);
  const scene = cleanScene(d.scene);
  const rules = await checkRules(d.rules, room);
  if (d.v !== 2 || !scene || !rules) return null;
  const m: Manifest = {
    v: 2,
    name: cleanText(d.name, 60) || "Room",
    ver: cleanNum(d.ver, 0, MAX_COUNTER) ?? 0,
    at: cleanNum(d.at, 0, 1e15) ?? 0,
    rules,
    scene,
    osig: typeof d.osig === "string" ? d.osig : undefined,
  };
  return !ownerOnly(rules) || verifyText(signedPart(d), m.osig, rules.owner) ? m : null;
}

/**
 * Is copy a better than copy b? The one saved under the newer rules first (only the owner changes them, so a copy
 * saved before building became owner-only can't win), then the higher version, then the later save.
 */
export function newer(a: Manifest, b: Manifest): boolean {
  if (a.rules.ver !== b.rules.ver) return a.rules.ver > b.rules.ver;
  return a.ver > b.ver || (a.ver === b.ver && a.at > b.at);
}
