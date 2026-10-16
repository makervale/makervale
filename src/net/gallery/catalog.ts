/** Reading the Gallery: the heads of the worlds on the relays, and the scene of one version, checked all the way. */
import type { World } from "@/world/model";
import type { NostrEvent } from "../nostr";
import { APP_DATA_KIND, eventTag, verifyEvent } from "../nostr";
import { plainCodec } from "../pieces/codec";
import { putBack } from "../pieces/repair";
import { readScene } from "../pieces/scene";
import { queryRelays, queryRelaysDetailed } from "../relay-query";
import { hashHex } from "../seal";
import { authorKey } from "./author";
import { isHidden } from "./hidden";
import type { WorldHead } from "./model";
import { WORLD_TAG, readHead, readVersion, versionTag } from "./model";

const LIMIT = 300;
const REPAIR_AFTER_MS = 15_000;
const enc = new TextEncoder();

/** the newest head per world: an author's later head replaces the earlier one */
function heads(events: NostrEvent[]): WorldHead[] {
  const newest = new Map<string, NostrEvent>();
  for (const ev of events) {
    if (ev.kind !== APP_DATA_KIND || !verifyEvent(ev)) continue;
    const key = ev.pubkey + "|" + eventTag(ev, "d");
    const had = newest.get(key);
    if (!had || had.created_at < ev.created_at) newest.set(key, ev);
  }
  const out: WorldHead[] = [];
  for (const ev of newest.values()) {
    let raw: unknown;
    try {
      raw = JSON.parse(ev.content);
    } catch {
      continue;
    }
    const head = readHead(raw, ev.pubkey, ev.created_at);
    if (head) out.push(head);
  }
  return out.sort((a, b) => b.updated - a.updated);
}

/** the worlds in the Gallery, newest first, without the ones you hid */
export async function browseGallery(): Promise<WorldHead[]> {
  const events = await queryRelays([{ kinds: [APP_DATA_KIND], "#t": [WORLD_TAG], limit: LIMIT }]);
  return heads(events).filter((h) => !isHidden(h));
}

export async function myWorlds(): Promise<WorldHead[]> {
  return heads(await queryRelays([{ kinds: [APP_DATA_KIND], authors: [authorKey()], "#t": [WORLD_TAG] }]));
}

/** the scene of one version, or null if it can't be had whole (or isn't the one the head names) */
export async function loadVersion(head: WorldHead, v: number): Promise<World | null> {
  const info = head.versions.find((x) => x.v === v);
  if (!info) return null;
  const found = await queryRelaysDetailed([
    { kinds: [APP_DATA_KIND], authors: [head.author], "#d": [versionTag(head.id, v)] },
  ]);
  for (const ev of found.events) {
    if (!verifyEvent(ev) || (await hashHex(enc.encode(ev.content))) !== info.hash) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(ev.content);
    } catch {
      continue;
    }
    const version = readVersion(raw, v);
    if (!version) continue;
    const scene = await readScene(plainCodec(head.author), head.author, version.scene, { ...found, events: [ev] });
    if (!scene) return null;
    // whoever looks at a world puts back what relays lost of it
    setTimeout(() => void putBack(scene.seen).catch(() => 0), REPAIR_AFTER_MS);
    return scene.world;
  }
  return null;
}
