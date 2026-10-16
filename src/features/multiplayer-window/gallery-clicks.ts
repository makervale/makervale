/** Clicks in the Gallery: load it, look at a world, hide, publish, unpublish; and the bar shown while viewing. */
import { toast } from "@/ui/toast";
import { findWorld } from "./gallery-view";
import { refreshMine } from "./room-clicks";
import type { MpWindow } from "./state";

export async function loadGallery(win: MpWindow): Promise<void> {
  const s = win.deps.session;
  win.state.galleryBusy = true;
  win.render();
  const [all, mine] = await Promise.all([s.browseGallery().catch(() => []), s.myWorlds().catch(() => [])]);
  Object.assign(win.state, { gallery: all, myWorlds: mine, galleryBusy: false });
  win.render();
}

const field = (win: MpWindow, sel: string) => win.body.querySelector<HTMLInputElement>(sel)?.value.trim() ?? "";

async function publish(win: MpWindow): Promise<void> {
  const target = field(win, "#mp-pub-target");
  const previous = target ? (win.state.myWorlds.find((h) => h.author + ":" + h.id === target) ?? null) : null;
  const title = field(win, "#mp-pub-title") || previous?.title || "";
  if (!title) return toast("Give it a title first");
  toast("Publishing…");
  const head = await win.deps.session.publish(
    { title, about: field(win, "#mp-pub-about") || previous?.about || "", note: field(win, "#mp-pub-note") },
    previous,
  );
  if (!head) return toast("Couldn't publish: no relay took it. Try again in a moment.");
  win.state.publishing = false;
  toast(`Published "${head.title}" v${head.versions[head.versions.length - 1].v}`);
  void loadGallery(win);
}

function view(win: MpWindow, key: string): void {
  const h = findWorld(win.state, key);
  if (!h) return;
  toast(`Opening "${h.title}"…`);
  void win.deps.session.viewWorld(h, h.versions[h.versions.length - 1].v).then((ok) => {
    toast(
      ok
        ? `Viewing "${h.title}". Your scene is safe and comes back when you close it.`
        : "Couldn't get the whole world from the relays.",
    );
  });
}

function unpublish(win: MpWindow, key: string): void {
  const h = findWorld(win.state, key);
  if (!h) return;
  toast(`Unpublish "${h.title}"? It leaves the Gallery; copies people made stay theirs.`, {
    label: "Unpublish",
    run: () => void win.deps.session.unpublish(h).then(() => loadGallery(win)),
  });
}

function hide(win: MpWindow, key: string): void {
  const h = findWorld(win.state, key);
  if (!h) return;
  win.deps.session.hideWorld(h);
  win.state.gallery = (win.state.gallery ?? []).filter((x) => x !== h);
  toast(`Hidden. Also hide everything by ${h.by}?`, {
    label: "Hide all",
    run: () => (win.deps.session.hideAuthor(h.author), void loadGallery(win)),
  });
  win.render();
}

function keyClick(win: MpWindow, t: HTMLElement): boolean {
  const s = win.deps.session;
  if (t.closest("#mp-key-copy"))
    navigator.clipboard?.writeText(s.exportAuthorKey()).then(() => toast("Author key copied. Keep it secret."));
  else if (t.closest("#mp-key-import")) {
    const k = prompt(
      "Paste an author key (64 characters). Worlds signed by your current key can then no longer be updated from here.",
    );
    if (k !== null) toast(s.importAuthorKey(k) ? "Author key changed" : "That isn't an author key");
  } else if (t.closest("#mp-unhide")) {
    s.unhideAll();
    toast("Hidden worlds show again");
  } else return false;
  return true;
}

/** true if the click was one of these */
export function galleryClick(win: MpWindow, t: HTMLElement): boolean {
  const pick = (attr: string) => t.closest<HTMLElement>(`[${attr}]`)?.getAttribute(attr) ?? null;
  const [viewKey, hideKey, unpubKey] = [pick("data-view"), pick("data-hide"), pick("data-unpublish")];
  if (t.closest("#mp-publish-open, #mp-publish-cancel")) {
    win.state.publishing = !!t.closest("#mp-publish-open");
    win.render();
  } else if (t.closest("#mp-publish")) void publish(win);
  else if (t.closest("#mp-gallery-refresh")) void loadGallery(win);
  else if (viewKey) view(win, viewKey);
  else if (hideKey) hide(win, hideKey);
  else if (unpubKey) unpublish(win, unpubKey);
  else return keyClick(win, t);
  return true;
}

/** the bar over the view while looking at a world */
export function viewBarClick(win: MpWindow, what: string): void {
  const s = win.deps.session;
  if (what === "close") s.closeView();
  else
    void s.copyViewed().then((id) => {
      if (id) toast("This is your own copy now: a private room. Change anything.");
      void refreshMine(win);
    });
}
