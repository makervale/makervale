/**
 * Sealing what goes to the relays: JSON, deflated, then encrypted with the room's AES key (AES-GCM, which also
 * proves it was sealed by someone with the code). Content-addressed pieces use a deterministic IV (an HMAC of the
 * bytes), so the same piece always seals to the same bytes and is stored once.
 */
import { Inflate, deflateSync } from "fflate";
import type { RoomKeys } from "./room-keys";

const IV_BYTES = 12;
/** a sealed piece never unpacks to more than this: a crafted one can't fill the memory */
export const MAX_UNPACKED = 64 * 1024 * 1024;

export async function seal(keys: RoomKeys, plain: Uint8Array, deterministic = false): Promise<Uint8Array> {
  const iv = deterministic
    ? new Uint8Array(await crypto.subtle.sign("HMAC", keys.siv, plain as BufferSource)).slice(0, IV_BYTES)
    : crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keys.aes, plain as BufferSource));
  const out = new Uint8Array(IV_BYTES + body.length);
  out.set(iv);
  out.set(body, IV_BYTES);
  return out;
}

/** the plain bytes, or null if they weren't sealed with this room's key (or were changed since) */
export async function unseal(keys: RoomKeys, sealed: Uint8Array): Promise<Uint8Array | null> {
  if (sealed.length <= IV_BYTES) return null;
  try {
    const iv = sealed.slice(0, IV_BYTES);
    const body = sealed.slice(IV_BYTES);
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, keys.aes, body));
  } catch {
    return null;
  }
}

export const pack = (value: unknown): Uint8Array => deflateSync(new TextEncoder().encode(JSON.stringify(value)));

/** inflate and parse; null for anything broken or too big once inflated */
export function unpack(bytes: Uint8Array, max = MAX_UNPACKED): unknown {
  const parts: Uint8Array[] = [];
  let size = 0;
  let tooBig = false;
  try {
    const inflate = new Inflate((chunk) => {
      size += chunk.length;
      if (size > max) tooBig = true;
      else parts.push(chunk);
    });
    inflate.push(bytes, true);
  } catch {
    return null;
  }
  if (tooBig) return null;
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(all));
  } catch {
    return null;
  }
}

/** base64 for event content (Nostr content is text) */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array | null {
  try {
    const s = atob(text);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** hex SHA-256: names a sealed piece, so whoever fetches it can check it */
export async function hashHex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return Array.from(d, (x) => x.toString(16).padStart(2, "0")).join("");
}
