/** The session's part about the Gallery: browse, view, copy, publish and unpublish worlds, hide what you don't want. */
import type { Ctx } from "./context";
import { inRoom } from "./context";
import { sceneNow } from "./copies";
import { authorKey, exportAuthorKey, importAuthorKey } from "./gallery/author";
import { browseGallery, loadVersion, myWorlds } from "./gallery/catalog";
import { hideAuthor, hideWorld, unhideAll } from "./gallery/hidden";
import type { WorldHead } from "./gallery/model";
import { publishWorld, unpublishWorld } from "./gallery/publish";
import { amOwner } from "./rules";
import { closeView, copyViewed, view } from "./viewing";

export interface PublishForm {
  title: string;
  about: string;
  note: string;
}

export interface GalleryApi {
  browseGallery(): Promise<WorldHead[]>;
  myWorlds(): Promise<WorldHead[]>;
  /** false when it couldn't be had whole */
  viewWorld(head: WorldHead, version: number): Promise<boolean>;
  closeView(): void;
  copyViewed(): Promise<string | null>;
  /** your own scene, or a room you own (not a world you are viewing, not someone else's room) */
  canPublish(): boolean;
  /** the scene now as a new world, or as the next version of `previous`; null if the relays didn't take it */
  publish(form: PublishForm, previous: WorldHead | null): Promise<WorldHead | null>;
  unpublish(head: WorldHead): Promise<boolean>;
  hideWorld(head: WorldHead): void;
  hideAuthor(author: string): void;
  unhideAll(): void;
  authorKey(): string;
  exportAuthorKey(): string;
  importAuthorKey(text: string): boolean;
}

export function galleryApi(ctx: Ctx): GalleryApi {
  const canPublish = () => !ctx.net.viewing && (!inRoom(ctx) || amOwner(ctx));
  return {
    browseGallery,
    myWorlds,
    async viewWorld(head, version) {
      const world = await loadVersion(head, version);
      if (!world) return false;
      const latest = head.versions[head.versions.length - 1].v;
      await view(ctx, world, {
        title: head.title,
        by: head.by,
        version,
        latest,
        worldId: head.id,
        author: head.author,
      });
      return true;
    },
    closeView: () => closeView(ctx),
    copyViewed: () => copyViewed(ctx),
    canPublish,
    async publish(form, previous) {
      if (!canPublish()) return null;
      const by = ctx.deps.selfName();
      return publishWorld({ world: sceneNow(ctx), ...form, by, basedOn: "" }, previous);
    },
    unpublish: unpublishWorld,
    hideWorld,
    hideAuthor,
    unhideAll,
    authorKey,
    exportAuthorKey,
    importAuthorKey,
  };
}
