/** The Avatar window's markup: the floating window, and its body for the current identity and picker state. */
import { AVATARS, COLLECTIONS } from "@/avatar/vrm/registry";
import { esc } from "@/ui/dom";
import type { Identity } from "./identity";
import { gestureButtonsHTML, lookEditorHTML } from "./look-editor";
import type { PickerState } from "./tiles";
import { bundledTiles, filterAvatars, modelName, onlineTiles } from "./tiles";
import type { FigureStatus } from "./port";

const CLOSE_ICON = `<svg viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6">
  <path d="M1 1l8 8M9 1 1 9"/></svg>`;

const WINDOW = `<section class="floater" id="avwin" aria-label="Avatar" hidden>
  <div class="fhead" data-drag>
    <span class="ft">Avatar</span><button class="x" data-close="avwin" title="Close">${CLOSE_ICON}</button>
  </div>
  <div class="fbody mp av" id="av-body"></div>
</section>`;

const CREDITS = `<p class="note">Any humanoid VRM works (VRoid Studio makes them). It stays in this browser; people
  in your room get it directly from you.</p>
<p class="note">Avatars from the
  <a href="https://github.com/ToxSam/open-source-avatars" target="_blank" rel="noopener">Open Source Avatars</a>
  registry (100Avatars and other collections by Polygonal Mind, ToxSam, NeonGlitch86; all CC0). Animations from
  <a href="https://github.com/overte-org/overte" target="_blank" rel="noopener">Overte</a>
  (Apache-2.0, originally High Fidelity).</p>`;

/** adds the window to the stage; returns its body */
export function createAvatarWindow(stage: HTMLElement): HTMLElement {
  stage.insertAdjacentHTML("beforeend", WINDOW);
  return stage.querySelector<HTMLElement>("#av-body")!;
}

function currentBody(who: Identity): string {
  const model = who.look.model;
  const title = model ? esc(modelName(model)) : "Built-in figure";
  const back = model ? `<button class="btn small" id="av-figure">Use the built-in figure</button>` : "";
  const cur = `<div class="av-cur"><div><b>${title}</b><span class="note" id="av-status"></span></div>${back}</div>`;
  return cur + (model ? "" : lookEditorHTML(who.look));
}

function collectionSelect(col: number): string {
  const options = COLLECTIONS.map(
    (c, i) => `<option value="${i}" ${col === i ? "selected" : ""}>${esc(c.name)} · ${esc(c.by)}</option>`,
  );
  const all = `<option value="-1">All collections</option>`;
  return `<select class="cb" id="av-col" aria-label="Collection">${all}${options.join("")}</select>`;
}

function moreAvatars(state: PickerState, worn: string): string {
  const list = filterAvatars(AVATARS, state.col, state.query);
  const search = `<input class="tf" id="av-q" placeholder="Search" value="${esc(state.query)}"
    aria-label="Search avatars">`;
  const rest = list.length - state.shown;
  const more = rest > 0 ? `<button class="btn small" id="av-moremore">Show more (${rest})</button>` : "";
  return (
    `<h4>More avatars <span>${AVATARS.length}, CC0</span></h4>` +
    `<p class="note">Wearing one downloads it (once) from Arweave or IPFS: those sites see your IP address.</p>` +
    `<div class="mp-row">${collectionSelect(state.col)}${search}</div>` +
    `<div class="av-grid" id="av-more">${onlineTiles(list.slice(0, state.shown), worn)}</div>${more}`
  );
}

export function avatarBodyHTML(who: Identity, state: PickerState): string {
  const worn = who.look.model;
  const name = `<div class="mp-row"><label class="lbl" for="av-name">Name</label>
    <input class="tf" id="av-name" maxlength="32" value="${esc(who.name)}"></div>`;
  const own = `<h4>Your own</h4><div class="mp-row">
    <button class="btn small" id="av-file">Load a .vrm file…</button>
    <input type="file" id="av-input" accept=".vrm,.glb,model/gltf-binary" hidden></div>`;
  return (
    name +
    currentBody(who) +
    `<h4>Gestures</h4><div class="av-gest">${gestureButtonsHTML()}</div>` +
    `<h4>Featured avatars <span>CC0, free to wear</span></h4><div class="av-grid">${bundledTiles(worn)}</div>` +
    moreAvatars(state, worn) +
    own +
    CREDITS
  );
}

/** the line next to the model's name: loading, or why it failed */
export function statusText(model: string, f: FigureStatus | null): string {
  if (!model || !f) return "";
  if (f.loading) return " · loading…";
  if (f.failed) return " · couldn’t load (" + f.failed + "); showing the built-in figure";
  return "";
}
