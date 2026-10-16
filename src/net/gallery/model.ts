/**
 * A world in the Gallery, as it is on the relays. Its head (one replaceable event, signed by its author) says what
 * it is and lists its versions; each version is a frozen scene: its own event, pointing to the scene's pieces,
 * named in the head by the hash of its content. So "v2" always means exactly the same scene, and a newer version
 * never changes an older one.
 */
import type { SceneIndex } from "../pieces/scene";
import { asRecord, cleanList, cleanNum, cleanText, validId } from "../sanitize";

export const WORLD_TAG = "makervale-world";
export const headTag = (id: string): string => "w:" + id;
export const versionTag = (id: string, v: number): string => `w:${id}:${v}`;

export interface VersionInfo {
  v: number;
  /** ms */
  at: number;
  note: string;
  objects: number;
  /** sha256 of the version event's content */
  hash: string;
}

export interface WorldHead {
  id: string;
  title: string;
  about: string;
  by: string;
  author: string;
  versions: VersionInfo[];
  /** set when it started as a copy of someone else's world */
  basedOn: string;
  /** seconds, from the head event */
  updated: number;
}

export interface VersionContent {
  v: number;
  scene: SceneIndex;
}

const ID = /^[a-z0-9]{6,24}$/;
const HASH = /^[0-9a-f]{64}$/;
const MAX_VERSIONS = 200;

function cleanVersion(x: unknown): VersionInfo | null {
  const d = asRecord(x);
  const v = cleanNum(d.v, 1, 1e6);
  if (!v || typeof d.hash !== "string" || !HASH.test(d.hash)) return null;
  return {
    v,
    at: cleanNum(d.at, 0, 1e15) ?? 0,
    note: cleanText(d.note, 200),
    objects: cleanNum(d.objects, 0, 1e6) ?? 0,
    hash: d.hash,
  };
}

export function readHead(raw: unknown, author: string, updated: number): WorldHead | null {
  const d = asRecord(raw);
  if (d.v !== 1 || typeof d.id !== "string" || !ID.test(d.id)) return null;
  const versions = cleanList(d.versions, MAX_VERSIONS)
    .map(cleanVersion)
    .filter((x): x is VersionInfo => x !== null)
    .sort((a, b) => a.v - b.v);
  if (!versions.length) return null;
  const title = cleanText(d.title, 60) || "Untitled world";
  return {
    id: d.id,
    title,
    about: cleanText(d.about, 400),
    by: cleanText(d.by, 32) || "Someone",
    author,
    versions,
    basedOn: cleanText(d.basedOn, 100),
    updated,
  };
}

export function readVersion(raw: unknown, v: number): VersionContent | null {
  const d = asRecord(raw);
  const s = asRecord(d.scene);
  const buckets = cleanList(s.buckets, 5000).map((b) => cleanList(b, 400));
  if (d.v !== v || !buckets.every((b) => b.length && b.every((h) => typeof h === "string" && HASH.test(h))))
    return null;
  const order = cleanList(s.order, 5000).filter(validId);
  return { v, scene: { seq: Math.floor(cleanNum(s.seq, 1, 1e12) ?? 1), order, buckets: buckets as string[][] } };
}

export const newWorldId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => (b % 36).toString(36)).join("");
