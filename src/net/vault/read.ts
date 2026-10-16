/**
 * Opening a private room's copy from the relays: every manifest they hold for the room (under the room's key, and
 * the owner's when we know them), the best valid one, then its scene.
 */
import type { World } from "@/world/model";
import type { NostrEvent } from "../nostr";
import { APP_DATA_KIND } from "../nostr";
import { roomCodec } from "../pieces/codec";
import type { Sightings } from "../pieces/scene";
import { readScene } from "../pieces/scene";
import { queryRelaysDetailed } from "../relay-query";
import type { RoomKeys } from "../room-keys";
import { fromBase64, unpack, unseal } from "../seal";
import type { Manifest } from "./manifest";
import { MANIFEST_TAG, newer, readManifest } from "./manifest";

export interface VaultCopy {
  manifest: Manifest;
  world: World;
  seen: Sightings;
}

async function openManifest(keys: RoomKeys, ev: NostrEvent): Promise<Manifest | null> {
  const sealed = fromBase64(ev.content);
  const plain = sealed && (await unseal(keys, sealed));
  return plain ? readManifest(unpack(plain), keys.code) : null;
}

interface Best {
  manifest: Manifest;
  event: NostrEvent;
}

async function findManifest(keys: RoomKeys, owner: string | null) {
  const authors = owner ? [keys.pubkey, owner] : [keys.pubkey];
  const found = await queryRelaysDetailed([{ kinds: [APP_DATA_KIND], authors, "#d": [MANIFEST_TAG] }]);
  let best: Best | null = null;
  for (const ev of found.events) {
    const m = await openManifest(keys, ev);
    if (!m || (owner && m.rules.owner !== owner)) continue;
    if (!best || newer(m, best.manifest)) best = { manifest: m, event: ev };
  }
  return { best, found };
}

/** just the newest manifest, without fetching the scene */
export async function peekVault(keys: RoomKeys, owner: string | null): Promise<Manifest | null> {
  return (await findManifest(keys, owner)).best?.manifest ?? null;
}

/** the room's copy on the relays, or null when there is none (or none complete) */
export async function readVault(keys: RoomKeys, owner: string | null): Promise<VaultCopy | null> {
  const { best, found } = await findManifest(keys, owner);
  if (!best) return null;
  const scene = await readScene(roomCodec(keys), keys.pubkey, best.manifest.scene, { ...found, events: [best.event] });
  return scene && { manifest: best.manifest, ...scene };
}
