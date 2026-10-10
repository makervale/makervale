/**
 * The Avatar window: your name, your body (the built-in figure with its look, one of the included or online CC0
 * VRM avatars, or a .vrm file of your own) and gestures.
 */
import { onWindowToggled } from "@/ui/window";
import { storeIdentity } from "./identity";
import type { AvatarWindow, AvatarWindowDeps } from "./port";
import { wireActions } from "./actions";
import { FIRST_PAGE } from "./tiles";
import { avatarBodyHTML, createAvatarWindow, statusText } from "./view";

export type { AvatarWindowDeps } from "./port";
export type { Identity } from "./identity";
export { loadIdentity } from "./identity";

const STATUS_POLL_MS = 400;

export function mount(deps: AvatarWindowDeps): void {
  const stage = deps.stage ?? document.getElementById("stage") ?? document.body;
  const body = createAvatarWindow(stage);
  const win: AvatarWindow = {
    deps,
    body,
    picker: { col: -1, query: "", shown: FIRST_PAGE },
    render: () => {
      body.innerHTML = avatarBodyHTML(deps.identity, win.picker);
      renderStatus(win);
    },
    save: () => save(deps),
  };
  wireActions(win);
  let poll = 0;
  onWindowToggled((id, open) => {
    if (id !== "avwin") return;
    clearInterval(poll);
    if (!open) return;
    win.render();
    poll = watchStatus(win);
  });
  save(deps);
  win.render();
}

function save(deps: AvatarWindowDeps): void {
  const { name, look } = deps.identity;
  storeIdentity(deps.identity);
  deps.session.setIdentity(name, look);
  deps.avatar.setAvatarLook(name, look);
  deps.bus.emit("identity:changed");
}

function renderStatus(win: AvatarWindow): void {
  const status = win.body.querySelector<HTMLElement>("#av-status");
  if (status) status.textContent = statusText(win.deps.identity.look.model, win.deps.avatar.myFigure());
}

/** a model loads in the background: show when it is ready or failed */
function watchStatus(win: AvatarWindow): number {
  let last = "";
  return window.setInterval(() => {
    const f = win.deps.avatar.myFigure();
    const now = f ? `${f.loading}|${f.failed}|${!!f.vrm}` : "";
    if (now === last) return;
    last = now;
    renderStatus(win);
  }, STATUS_POLL_MS);
}
