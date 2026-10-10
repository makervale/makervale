/**
 * Avatar files people loaded themselves ("file:<sha-256>" models) travel peer to peer: whoever wears one hands out its
 * bytes on request, and the asker checks the hash (avatar/vrm does that).
 */
import { readStored } from "@/app/storage";
import { MAX_MODEL_BYTES } from "@/avatar/vrm/registry";
import type { Ctx } from "../context";

const FILE_PREFIX = "file:";
/** big files over slow links take a while */
const REQUEST_TIMEOUT_MS = 120_000;

/** a peer asked for the file I wear */
export async function fileForPeer(ctx: Ctx, hash: string): Promise<ArrayBuffer> {
  if (ctx.deps.selfLook().model !== FILE_PREFIX + hash) throw new Error("not here");
  const bytes = await readStored<ArrayBuffer>("files", hash);
  if (!bytes) throw new Error("not here");
  return bytes;
}

function asBuffer(x: unknown): ArrayBuffer | null {
  if (x instanceof ArrayBuffer) return x.byteLength <= MAX_MODEL_BYTES ? x : null;
  if (ArrayBuffer.isView(x) && x.byteLength <= MAX_MODEL_BYTES) {
    return new Uint8Array(x.buffer, x.byteOffset, x.byteLength).slice().buffer;
  }
  return null;
}

/** someone's own avatar file: ask the people in the room who wear it, one after another */
export async function fetchFile(ctx: Ctx, hash: string): Promise<ArrayBuffer | null> {
  for (const p of ctx.net.peers.values()) {
    const link = ctx.link;
    if (!link) return null;
    if (p.look.model !== FILE_PREFIX + hash) continue;
    try {
      const bytes = asBuffer(await link.requestFile(hash, p.id, REQUEST_TIMEOUT_MS));
      if (bytes) return bytes;
    } catch {
      /* try the next */
    }
  }
  return null;
}
