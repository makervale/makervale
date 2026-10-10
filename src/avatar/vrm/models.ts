/** The bytes of avatar models: downloaded once from the index, or loaded by you, then kept in this browser. */
import { readStored, sha256Hex, writeStored } from "@/app/storage";
import { MAX_MODEL_BYTES, modelURLs } from "./registry";

/** asks the people in the room for a "file:" model we don't have (the room code provides it) */
export type FetchRemote = (hash: string) => Promise<ArrayBuffer | null>;

const FILE_PREFIX = "file:";

const isGltf = (b: ArrayBuffer) => new TextDecoder().decode(new Uint8Array(b, 0, 4)) === "glTF";

async function download(url: string, model: string): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    if (Number(r.headers.get("content-length") ?? 0) > MAX_MODEL_BYTES) return null;
    const b = await r.arrayBuffer();
    if (b.byteLength > MAX_MODEL_BYTES || !isGltf(b)) return null;
    void writeStored("files", model, b);
    return b;
  } catch {
    return null;
  }
}

export class ModelLibrary {
  private readonly pending = new Map<string, Promise<ArrayBuffer>>();
  fetchRemote: FetchRemote = () => Promise.resolve(null);

  /** one request per model, however many bodies wear it; a failure is forgotten so it can be tried again */
  bytes(model: string): Promise<ArrayBuffer> {
    const hit = this.pending.get(model);
    if (hit) return hit;
    const p = model.startsWith(FILE_PREFIX) ? this.fileBytes(model.slice(FILE_PREFIX.length)) : this.indexBytes(model);
    this.pending.set(model, p);
    p.catch(() => this.pending.delete(model));
    return p;
  }

  /** keep a file you picked (after `check` accepted it); returns its model name */
  async addLocal(buf: ArrayBuffer, check: (buf: ArrayBuffer) => Promise<void>): Promise<string> {
    if (buf.byteLength > MAX_MODEL_BYTES) throw new Error("That file is larger than 40 MB");
    await check(buf);
    const hash = await sha256Hex(buf);
    await writeStored("files", hash, buf);
    this.pending.set(FILE_PREFIX + hash, Promise.resolve(buf));
    return FILE_PREFIX + hash;
  }

  /** a file someone loaded: ours, or theirs, checked against its hash */
  private async fileBytes(hash: string): Promise<ArrayBuffer> {
    const stored = await readStored<ArrayBuffer>("files", hash);
    if (stored) return stored;
    const b = await this.fetchRemote(hash);
    if (!b || b.byteLength > MAX_MODEL_BYTES || (await sha256Hex(b)) !== hash) throw new Error("model not available");
    await writeStored("files", hash, b);
    return b;
  }

  private async indexBytes(model: string): Promise<ArrayBuffer> {
    const cached = await readStored<ArrayBuffer>("files", model);
    if (cached) return cached;
    for (const url of modelURLs(model)) {
      const b = await download(url, model);
      if (b) return b;
    }
    throw new Error("could not download the avatar");
  }
}
