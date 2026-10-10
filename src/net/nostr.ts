/** Nostr events for the room list, signed with a throwaway key made for this session. */
import { schnorr } from "@noble/curves/secp256k1.js";

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** kind 30078 "application-specific data": replaceable per (pubkey, d tag) */
export const APP_DATA_KIND = 30078;

export const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const keys = schnorr.keygen();
const pubkey = hex(keys.publicKey);

export async function signedEvent(kind: number, tags: string[][], content: string): Promise<NostrEvent> {
  const ev = { pubkey, created_at: nowSeconds(), kind, tags, content };
  const serial = JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]);
  const id = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serial)));
  return { ...ev, id: hex(id), sig: hex(schnorr.sign(id, keys.secretKey)) };
}

/** the value of the first tag with this name, or "" */
export function eventTag(ev: { tags?: unknown }, name: string): string {
  if (!Array.isArray(ev.tags)) return "";
  const tag = ev.tags.find((t) => Array.isArray(t) && t[0] === name);
  return tag ? String(tag[1] ?? "") : "";
}
