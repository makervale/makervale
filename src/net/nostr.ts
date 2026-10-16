/**
 * Nostr events and signatures. Each visit has its own throwaway key: it signs the room's relay channel, so whoever
 * reads the channel knows which visit sent what, and nobody can pass for someone else there. Other keys sign other
 * things: a room's owner key its rules and live listing, your author key your worlds in the Gallery.
 */
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/** replaceable per (pubkey, d tag) */
export const APP_DATA_KIND = 30078;
export const DELETION_KIND = 5;

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

export const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export function fromHex(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const visit = schnorr.keygen();
/** peers learn it from our hello and match it against the relay channel */
export const visitKey = hex(visit.publicKey);

const eventId = (ev: Omit<NostrEvent, "id" | "sig">): Uint8Array =>
  sha256(new TextEncoder().encode(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content])));

export async function signedEventBy(
  secret: Uint8Array,
  kind: number,
  tags: string[][],
  content: string,
): Promise<NostrEvent> {
  const ev = { pubkey: hex(schnorr.getPublicKey(secret)), created_at: nowSeconds(), kind, tags, content };
  const id = eventId(ev);
  return { ...ev, id: hex(id), sig: hex(schnorr.sign(id, secret)) };
}

export const signedEvent = (kind: number, tags: string[][], content: string): Promise<NostrEvent> =>
  signedEventBy(visit.secretKey, kind, tags, content);

/** a relay could pass on anything */
export function verifyEvent(ev: NostrEvent): boolean {
  if (!HEX64.test(ev.pubkey) || !HEX128.test(ev.sig) || !Array.isArray(ev.tags)) return false;
  try {
    const id = eventId(ev);
    return hex(id) === ev.id && schnorr.verify(fromHex(ev.sig), id, fromHex(ev.pubkey));
  } catch {
    return false;
  }
}

const digestOf = (text: string): Uint8Array => sha256(new TextEncoder().encode(text));

export const signText = (text: string, secret: Uint8Array): string => hex(schnorr.sign(digestOf(text), secret));

export function verifyText(text: string, sig: unknown, pubkey: unknown): boolean {
  if (typeof sig !== "string" || !HEX128.test(sig) || typeof pubkey !== "string" || !HEX64.test(pubkey)) return false;
  try {
    return schnorr.verify(fromHex(sig), digestOf(text), fromHex(pubkey));
  } catch {
    return false;
  }
}

export function eventTag(ev: { tags?: unknown }, name: string): string {
  if (!Array.isArray(ev.tags)) return "";
  const tag = ev.tags.find((t) => Array.isArray(t) && t[0] === name);
  return tag ? String(tag[1] ?? "") : "";
}
