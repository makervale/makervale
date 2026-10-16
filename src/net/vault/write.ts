/** Saving a private room's copy to the relays: its pieces first, then the manifest that points to them. */
import type { World } from "@/world/model";
import type { Rules } from "@/lib/rules";
import { APP_DATA_KIND, signedEventBy } from "../nostr";
import { roomCodec } from "../pieces/codec";
import { writeScene } from "../pieces/scene";
import { publishEvent } from "../relay-query";
import type { RoomKeys } from "../room-keys";
import { pack, seal, toBase64 } from "../seal";
import type { Manifest } from "./manifest";
import { MANIFEST_TAG, ownerSigned } from "./manifest";

/** a room nobody opens for half a year fades from the relays (everyone who was in it keeps their own copy) */
export const PIECE_TTL_S = 180 * 86_400;

export interface SaveRequest {
  world: World;
  name: string;
  ver: number;
  rules: Rules;
  /** where only the owner builds, the owner signs the manifest */
  ownerSecret: Uint8Array | null;
}

/** how many relays took the manifest (0: the copy on the relays stays the previous one) */
export async function writeVault(keys: RoomKeys, req: SaveRequest): Promise<number> {
  const scene = await writeScene(roomCodec(keys), req.world, { signer: keys.secret, ttlS: PIECE_TTL_S });
  if (!scene) return 0;
  const m: Manifest = { v: 2, name: req.name, ver: req.ver, at: Date.now(), rules: req.rules, scene };
  const content = toBase64(await seal(keys, pack(req.ownerSecret ? ownerSigned(m, req.ownerSecret) : m)));
  const publish = async (secret: Uint8Array) =>
    publishEvent(await signedEventBy(secret, APP_DATA_KIND, [["d", MANIFEST_TAG]], content));
  const relays = await publish(keys.secret);
  if (req.ownerSecret) await publish(req.ownerSecret);
  return relays;
}
