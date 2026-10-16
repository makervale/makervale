/**
 * Everything a room needs, derived from its code alone. A slow key derivation (PBKDF2) makes guessing codes
 * expensive; HKDF then splits the result into independent keys:
 *  - where the peers meet (the Trystero room) and the password that encrypts their handshake, so relays can't
 *    read the addresses in it nor work back to the code;
 *  - the AES key that seals the room's copy on the relays and the messages sent through them;
 *  - the Nostr key the room's copy is published under, and the tag of the room's relay channel.
 * Anyone with the code gets the same keys; nobody without it can read or find anything.
 */
import { schnorr } from "@noble/curves/secp256k1.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export interface RoomKeys {
  code: string;
  /** the Trystero room id */
  topic: string;
  /** the Trystero password: encrypts the WebRTC offers and answers on the relays */
  password: string;
  /** the tag of the room's relay channel */
  channel: string;
  /** seals what the room keeps on the relays */
  aes: CryptoKey;
  /** makes the seal of the same bytes the same (content-addressed pieces of the room's copy) */
  siv: CryptoKey;
  /** the room's own Nostr key: anyone with the code can publish the room's copy */
  secret: Uint8Array;
  pubkey: string;
}

const SALT = "makervale/room/v1";
const ITERATIONS = 120_000;
const enc = new TextEncoder();

async function stretch(code: string): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  const params = { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(SALT), iterations: ITERATIONS };
  return new Uint8Array(await crypto.subtle.deriveBits(params, base, 256));
}

const part = (master: Uint8Array, info: string): Uint8Array => hkdf(sha256, master, undefined, enc.encode(info), 32);

/** a valid secp256k1 secret from 32 derived bytes (an invalid one has odds of 2^-128; hash again if so) */
function nostrSecret(master: Uint8Array): Uint8Array {
  let k = part(master, "nostr");
  while (!isValidSecret(k)) k = sha256(k);
  return k;
}

function isValidSecret(k: Uint8Array): boolean {
  try {
    schnorr.getPublicKey(k);
    return true;
  } catch {
    return false;
  }
}

const importAes = (raw: Uint8Array) =>
  crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
const importHmac = (raw: Uint8Array) =>
  crypto.subtle.importKey("raw", raw as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

async function derive(code: string): Promise<RoomKeys> {
  const master = await stretch(code);
  const secret = nostrSecret(master);
  return {
    code,
    topic: bytesToHex(part(master, "topic")),
    password: bytesToHex(part(master, "password")),
    channel: bytesToHex(part(master, "channel")),
    aes: await importAes(part(master, "aes")),
    siv: await importHmac(part(master, "siv")),
    secret,
    pubkey: bytesToHex(schnorr.getPublicKey(secret)),
  };
}

const cache = new Map<string, Promise<RoomKeys>>();

/** the keys of a room, by its canonical code (derived once per page) */
export function roomKeys(code: string): Promise<RoomKeys> {
  let keys = cache.get(code);
  if (!keys) cache.set(code, (keys = derive(code)));
  return keys;
}
