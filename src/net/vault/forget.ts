/**
 * Taking a private room's copy off the relays. An empty manifest replaces the real one at once (on every relay that
 * keeps the latest), and a deletion request (NIP-09) asks the relays to drop the pieces too. Relays may ignore it;
 * the pieces then expire on their own, and without a manifest nobody can find them.
 */
import { APP_DATA_KIND, DELETION_KIND, signedEventBy } from "../nostr";
import { roomCodec } from "../pieces/codec";
import { knownPieces, pieceTag } from "../pieces/scene";
import { publishEvent } from "../relay-query";
import type { RoomKeys } from "../room-keys";
import { pack, seal, toBase64 } from "../seal";
import { MANIFEST_TAG } from "./manifest";

/** resolves with how many relays took the empty manifest */
export async function forgetVault(keys: RoomKeys, signers: Uint8Array[], hashes: string[]): Promise<number> {
  const empty = toBase64(await seal(keys, pack({ v: 0, gone: true })));
  const known = knownPieces(roomCodec(keys).scope);
  const all = [...new Set([...hashes, ...known.keys()])];
  let reached = 0;
  for (const signer of signers) {
    const tomb = await signedEventBy(signer, APP_DATA_KIND, [["d", MANIFEST_TAG]], empty);
    reached = Math.max(reached, await publishEvent(tomb));
    const address = (d: string) => ["a", `${APP_DATA_KIND}:${tomb.pubkey}:${d}`];
    const tags = [address(MANIFEST_TAG), ...all.map((h) => address(pieceTag(h)))];
    await publishEvent(await signedEventBy(signer, DELETION_KIND, tags, "room deleted"));
  }
  known.clear();
  return reached;
}
