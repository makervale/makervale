/**
 * Keeping a private room's copy alive: whoever opens it puts back what relays lost (pieces/repair.ts), and pieces
 * about to expire are signed again with a fresh expiry, unless only the owner builds (then renewing is theirs).
 */
import type { NostrEvent } from "../nostr";
import { eventTag, nowSeconds } from "../nostr";
import { putBack } from "../pieces/repair";
import type { Sightings } from "../pieces/scene";
import { pieceEvent } from "../pieces/scene";
import { publishEvent } from "../relay-query";
import type { RoomKeys } from "../room-keys";
import { fromBase64 } from "../seal";
import { PIECE_TTL_S } from "./write";

export const RENEW_WITHIN_S = 30 * 86_400;
const MAX_RENEW = 60;

export function expiringPieces(seen: Sightings, roomPubkey: string, now = nowSeconds()): NostrEvent[] {
  return seen.events.filter((ev) => {
    if (ev.pubkey !== roomPubkey || !eventTag(ev, "d").startsWith("b:")) return false;
    const expires = +eventTag(ev, "expiration") || 0;
    return expires > 0 && expires - now < RENEW_WITHIN_S;
  });
}

export async function repairVault(keys: RoomKeys, seen: Sightings, renew: boolean): Promise<number> {
  let sent = 0;
  for (const ev of renew ? expiringPieces(seen, keys.pubkey).slice(0, MAX_RENEW) : []) {
    const bytes = fromBase64(ev.content);
    if (!bytes) continue;
    await publishEvent(await pieceEvent({ hash: eventTag(ev, "d").slice(2), bytes }, keys.secret, PIECE_TTL_S));
    sent++;
  }
  return sent + (await putBack(seen));
}
