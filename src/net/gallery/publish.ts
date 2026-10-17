/**
 * Publishing: the scene is frozen into the next version of a world (its pieces first, then the version, then the
 * head that lists it). Nothing of a room is published unless its owner does this; a room and its published world
 * go their own ways after.
 */
import { fillOf } from "@/lib/weight";
import type { World } from "@/world/model";
import { APP_DATA_KIND, DELETION_KIND, nowSeconds, signedEventBy } from "../nostr";
import { plainCodec } from "../pieces/codec";
import { writeScene } from "../pieces/scene";
import { publishEvent } from "../relay-query";
import { hashHex } from "../seal";
import { authorKey, authorSecret } from "./author";
import type { WorldHead } from "./model";
import { WORLD_TAG, headTag, newWorldId, versionTag } from "./model";

export interface PublishRequest {
  world: World;
  title: string;
  about: string;
  /** what's new in this version */
  note: string;
  by: string;
  basedOn: string;
}

const enc = new TextEncoder();

async function publishHead(head: Omit<WorldHead, "author" | "updated">): Promise<number> {
  const content = JSON.stringify({ v: 1, ...head });
  const tags = [
    ["d", headTag(head.id)],
    ["t", WORLD_TAG],
  ];
  return publishEvent(await signedEventBy(authorSecret(), APP_DATA_KIND, tags, content));
}

const nextVersion = (previous: WorldHead | null): number =>
  previous ? previous.versions[previous.versions.length - 1].v + 1 : 1;

/** a new world (no `previous`) or the next version of one of ours; null if the relays didn't take it */
export async function publishWorld(req: PublishRequest, previous: WorldHead | null): Promise<WorldHead | null> {
  const secret = authorSecret();
  const scene = await writeScene(plainCodec(authorKey()), req.world, { signer: secret, ttlS: null });
  if (!scene) return null;
  const id = previous?.id ?? newWorldId();
  const v = nextVersion(previous);
  const content = JSON.stringify({ v, scene });
  if (!(await publishEvent(await signedEventBy(secret, APP_DATA_KIND, [["d", versionTag(id, v)]], content))))
    return null;
  const info = {
    v,
    at: Date.now(),
    note: req.note.slice(0, 200),
    objects: req.world.objects.length,
    fill: fillOf(req.world.objects),
    hash: await hashHex(enc.encode(content)),
  };
  const head = {
    id,
    title: req.title,
    about: req.about,
    by: req.by,
    basedOn: previous?.basedOn ?? req.basedOn,
    versions: [...(previous?.versions ?? []), info],
  };
  if (!(await publishHead(head))) return null;
  return { ...head, author: authorKey(), updated: Math.floor(Date.now() / 1000) };
}

/** off the Gallery: the head says it is gone, and the relays are asked to delete it all (they may not) */
export async function unpublishWorld(head: WorldHead): Promise<boolean> {
  // relays keep the newest head by its second: in the same second as the last one, "gone" could lose to it
  while (nowSeconds() <= head.updated) await new Promise((r) => setTimeout(r, 250));
  const secret = authorSecret();
  const gone = JSON.stringify({ v: 1, id: head.id, gone: true });
  const reached = await publishEvent(
    await signedEventBy(
      secret,
      APP_DATA_KIND,
      [
        ["d", headTag(head.id)],
        ["t", WORLD_TAG],
      ],
      gone,
    ),
  );
  const address = (d: string) => ["a", `${APP_DATA_KIND}:${authorKey()}:${d}`];
  const tags = [address(headTag(head.id)), ...head.versions.map((x) => address(versionTag(head.id, x.v)))];
  await publishEvent(await signedEventBy(secret, DELETION_KIND, tags, "world unpublished"));
  return reached > 0;
}
