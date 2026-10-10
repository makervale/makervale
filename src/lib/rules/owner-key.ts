/** The owner's secret key, kept per room so they stay the host after a reload or when they reopen the room. */
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import type { KeyStore } from "./model";
import { HEX_KEY } from "./signing";

const keyName = (room: string) => "pias.owner." + room;

export function loadOwnerKey(keys: KeyStore, room: string): Uint8Array | null {
  try {
    const k = keys.get(keyName(room));
    return k && HEX_KEY.test(k) ? hexToBytes(k) : null;
  } catch {
    return null;
  }
}

export function saveOwnerKey(keys: KeyStore, room: string, secretKey: Uint8Array): void {
  try {
    keys.set(keyName(room), bytesToHex(secretKey));
  } catch {
    // the room still works; we just won't stay host after a reload
  }
}
