/** VRM avatar models: name a model, get a body. See registry.ts for what a model name may be. */
import type { FetchRemote } from "./models";
import { ModelLibrary } from "./models";
import type { VRMBody } from "./parse";
import { parseVRM } from "./parse";

export type { VRMBody } from "./parse";
export type { FetchRemote } from "./models";
export * from "./registry";

export class VrmLoader {
  private readonly library = new ModelLibrary();

  /** where "file:" models we don't have come from (the room asks its peers) */
  setRemoteFetch(fetchRemote: FetchRemote): void {
    this.library.fetchRemote = fetchRemote;
  }

  /** the raw file, e.g. to send it to a peer who asked */
  bytes(model: string): Promise<ArrayBuffer> {
    return this.library.bytes(model);
  }

  async load(model: string): Promise<VRMBody> {
    return parseVRM(await this.library.bytes(model));
  }

  /** keep a .vrm you picked, once it's known to be a usable humanoid; returns its model name */
  addLocalModel(buf: ArrayBuffer): Promise<string> {
    return this.library.addLocal(buf, async (b) => (await parseVRM(b)).dispose());
  }
}
