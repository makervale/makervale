/**
 * Who someone is in a room, across reloads: a key of their own for each room, derived from one secret kept in
 * their browser. The owner's rules name people by it (who may build, who was removed), so a reload doesn't undo
 * them. A different key per room means people who meet in two rooms can't tell from the keys it is the same person.
 *
 * Each hello proves the key: a signature over the room, the peer id of this visit and the visit key that signs our
 * relay channel, so nobody can claim someone else's key.
 */
import { schnorr } from "@noble/curves/secp256k1.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { fromHex, hex, signText, verifyText } from "./nostr";

const STORE_KEY = "mv.person";
const enc = new TextEncoder();

let secret: Uint8Array | null = null;

function browserSecret(): Uint8Array {
  if (secret) return secret;
  try {
    const kept = localStorage.getItem(STORE_KEY);
    if (kept && /^[0-9a-f]{64}$/.test(kept)) return (secret = fromHex(kept));
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

function validSecret(k: Uint8Array): boolean {
  try {
    schnorr.getPublicKey(k);
    return true;
  } catch {
    return false;
  }
}

const perRoom = new Map<string, Uint8Array>();

function roomSecret(room: string): Uint8Array {
  let k = perRoom.get(room);
  if (k) return k;
  k = hkdf(sha256, browserSecret(), undefined, enc.encode("makervale/person/" + room), 32);
  while (!validSecret(k)) k = sha256(k);
  perRoom.set(room, k);
  return k;
}

export interface PersonProof {
  pk: string;
  ps: string;
}

const claim = (room: string, peerId: string, visitKey: string) => `makervale-person|${room}|${peerId}|${visitKey}`;

export function proveMe(room: string, peerId: string, visitKey: string): PersonProof {
  const k = roomSecret(room);
  return { pk: hex(schnorr.getPublicKey(k)), ps: signText(claim(room, peerId, visitKey), k) };
}

export const myPersonKey = (room: string): string => hex(schnorr.getPublicKey(roomSecret(room)));

/** their key for this room, if the proof holds; "" if not */
export function checkPerson(room: string, peerId: string, d: { pk?: unknown; ps?: unknown; vk?: unknown }): string {
  if (typeof d.vk !== "string") return "";
  return verifyText(claim(room, peerId, d.vk), d.ps, d.pk) ? (d.pk as string) : "";
}
