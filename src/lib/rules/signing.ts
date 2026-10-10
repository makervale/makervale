/** The crypto behind the rules: a SHA-256 digest of the fields, signed with BIP340 Schnorr on secp256k1. */
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import type { Rules, UnsignedRules } from "./model";

// bumping this invalidates every signature made before it
const PAYLOAD_TAG = "sandbox-rules-v1";

export const HEX_KEY = /^[0-9a-f]{64}$/;
export const HEX_SIG = /^[0-9a-f]{128}$/;

function digest(r: UnsignedRules): Uint8Array {
  const fields = [PAYLOAD_TAG, r.room, r.owner, r.host, r.build, r.banned, r.ver];
  return sha256(new TextEncoder().encode(JSON.stringify(fields)));
}

export function newSecretKey(): Uint8Array {
  return schnorr.keygen().secretKey;
}

export function publicKeyHex(secretKey: Uint8Array): string {
  return bytesToHex(schnorr.getPublicKey(secretKey));
}

export function sign(r: UnsignedRules, secretKey: Uint8Array): Rules {
  return { ...r, sig: bytesToHex(schnorr.sign(digest(r), secretKey)) };
}

/** is `r.sig` a valid signature by `r.owner` over the other fields? */
export function verify(r: Rules): boolean {
  try {
    return schnorr.verify(hexToBytes(r.sig), digest(r), hexToBytes(r.owner));
  } catch {
    return false;
  }
}
