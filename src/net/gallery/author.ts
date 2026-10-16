/**
 * Your author key: it signs every world you publish, so nobody else can change or remove your worlds, and only you
 * can publish their next versions. It lives in this browser; Settings can show it, to move it to another browser.
 * Losing it means your worlds stay up but you can't update them any more.
 */
import { schnorr } from "@noble/curves/secp256k1.js";
import { fromHex, hex } from "../nostr";

const STORE_KEY = "mv.author";
const HEX = /^[0-9a-f]{64}$/;

let secret: Uint8Array | null = null;

function valid(k: Uint8Array): boolean {
  try {
    schnorr.getPublicKey(k);
    return true;
  } catch {
    return false;
  }
}

export function authorSecret(): Uint8Array {
  if (secret) return secret;
  try {
    const kept = localStorage.getItem(STORE_KEY);
    if (kept && HEX.test(kept) && valid(fromHex(kept))) return (secret = fromHex(kept));
  } catch {
    // no storage: a key for this visit only
  }
  secret = schnorr.utils.randomSecretKey();
  try {
    localStorage.setItem(STORE_KEY, hex(secret));
  } catch {
    // as above
  }
  return secret;
}

export const authorKey = (): string => hex(schnorr.getPublicKey(authorSecret()));

export const exportAuthorKey = (): string => hex(authorSecret());

/** false if it isn't a key */
export function importAuthorKey(text: string): boolean {
  const k = text.trim().toLowerCase();
  if (!HEX.test(k) || !valid(fromHex(k))) return false;
  try {
    localStorage.setItem(STORE_KEY, k);
  } catch {
    return false;
  }
  secret = fromHex(k);
  return true;
}
