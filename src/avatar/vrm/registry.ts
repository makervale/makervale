/**
 * The avatar models anyone in a room can name. A model is a short string that everyone resolves the same way,
 * and nothing else is ever fetched:
 *   - "ar:…", "dw:…", "pn:…" or a full URL that appears in the Open Source Avatars index we ship (CC0 avatars on
 *     Arweave/IPFS), downloaded when first worn and then kept in this browser.
 *   - "file:<sha-256>": a .vrm you loaded yourself. It's kept in your browser, and people in your room get the
 *     bytes from you directly (and check the hash).
 */
import index from "./avatar-index.json";
import bundled from "./bundled.json";
import thumbs from "./avatar-thumbs.json";

export const MAX_MODEL_BYTES = 40 * 1024 * 1024;

const PREFIX: Record<string, string> = {
  ar: "https://arweave.net/",
  dw: "https://dweb.link/ipfs/",
  pn: "https://gateway.pinata.cloud/ipfs/",
};

export interface IndexEntry {
  name: string;
  collection: number;
  model: string;
  thumb: string;
}

export interface Collection {
  name: string;
  by: string;
  license: string;
}

/** avatars we ship with the app (files under assets/avatars), by their place in the index */
export interface BundledEntry {
  model: string;
  file: string;
  name: string;
  i: number;
}

/** one sprite sheet of index thumbnails: `have` lists the index entries it holds, in tile order */
export interface ThumbSheet {
  file: string;
  tile: number;
  cols: number;
  have: number[];
}

type RawEntry = [string, number, string, string];

export const AVATARS: IndexEntry[] = (index.avatars as RawEntry[]).map(([name, collection, model, thumb]) => ({
  name,
  collection,
  model,
  thumb,
}));
export const COLLECTIONS: Collection[] = index.collections;
export const BUNDLED: BundledEntry[] = bundled;
export const THUMB_SHEET: ThumbSheet = thumbs;

const KNOWN = new Set<string>(AVATARS.map((a) => a.model));
const FILE_MODEL = /^file:[0-9a-f]{64}$/;

/** "" (the built-in figure), a file you loaded, or a model from the index */
export function validModel(m: unknown): m is string {
  return typeof m === "string" && (m === "" || FILE_MODEL.test(m) || KNOWN.has(m));
}

function resolve(ref: string): string | null {
  const k = ref.indexOf(":");
  const prefix = PREFIX[ref.slice(0, k)];
  if (prefix) return prefix + ref.slice(k + 1);
  return ref.startsWith("https://") ? ref : null;
}

/** where to get an index model: the copy published with the page if it is a featured one, then the registry */
export function modelURLs(m: string): string[] {
  if (!KNOWN.has(m)) return [];
  const local = BUNDLED.find((b) => b.model === m)?.file;
  const online = resolve(m);
  return [...(local ? [local] : []), ...(online ? [online] : [])];
}
