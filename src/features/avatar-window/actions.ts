/** What clicks, changes and typing in the Avatar window do. */
import { cleanLook } from "@/avatar/look";
import { toast } from "@/ui/toast";
import { cleanName } from "./identity";
import { NUMERIC_LOOK } from "./look-editor";
import type { AvatarWindow } from "./port";
import { FIRST_PAGE, NEXT_PAGE } from "./tiles";

/** typing in the search box redraws the list once you pause */
const SEARCH_DELAY_MS = 200;

export function wireActions(win: AvatarWindow): void {
  win.body.addEventListener("click", (e) => onClick(win, e.target as HTMLElement));
  win.body.addEventListener("change", (e) => void onChange(win, e.target as HTMLInputElement));
  let searchTimer = 0;
  win.body.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id !== "av-q") return;
    win.picker.query = t.value;
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => redrawKeepingSearch(win, t.selectionStart), SEARCH_DELAY_MS);
  });
}

function wear(win: AvatarWindow, model: string): void {
  const who = win.deps.identity;
  who.look = cleanLook({ ...who.look, model });
  win.save();
  win.render();
}

function onClick(win: AvatarWindow, t: HTMLElement): void {
  const who = win.deps.identity;
  const model = t.closest<HTMLElement>("[data-model]");
  const gesture = t.closest<HTMLElement>("[data-gesture]");
  const skin = t.closest<HTMLElement>("[data-skin]");
  if (model) wear(win, model.dataset.model!);
  else if (t.closest("#av-figure")) wear(win, "");
  else if (gesture) win.deps.bus.emit("gesture:play", { name: gesture.dataset.gesture! });
  else if (skin) {
    who.look = { ...who.look, skin: skin.dataset.skin! };
    win.save();
    win.render();
  } else if (t.closest("#av-moremore")) {
    win.picker.shown += NEXT_PAGE;
    win.render();
  } else if (t.closest("#av-file")) win.body.querySelector<HTMLInputElement>("#av-input")!.click();
}

async function onChange(win: AvatarWindow, t: HTMLInputElement): Promise<void> {
  const who = win.deps.identity;
  if (t.id === "av-name") {
    who.name = cleanName(t.value, who.name);
    win.save();
  } else if (t.id === "av-col") {
    win.picker.col = Number(t.value);
    win.picker.shown = FIRST_PAGE;
    win.render();
  } else if (t.id === "av-input") await loadFile(win, t);
  else if (t.dataset.look) changeLook(win, t, t.dataset.look);
}

function changeLook(win: AvatarWindow, t: HTMLInputElement, key: string): void {
  const who = win.deps.identity;
  who.look = cleanLook({ ...who.look, [key]: NUMERIC_LOOK.has(key) ? Number(t.value) : t.value });
  win.save();
  // the swatch next to a colour picker shows the new colour without a redraw (which would close the picker)
  const sample = t.parentElement?.querySelector<HTMLElement>("span");
  if (sample && t.type === "color") sample.style.background = t.value;
}

async function loadFile(win: AvatarWindow, input: HTMLInputElement): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;
  toast("Reading " + file.name + "…");
  try {
    wear(win, await win.deps.avatar.addLocalModel(await file.arrayBuffer()));
    toast("You are wearing " + file.name);
  } catch (err) {
    toast("Can’t use that file: " + ((err as Error).message || String(err)));
  }
  input.value = "";
}

function redrawKeepingSearch(win: AvatarWindow, caret: number | null): void {
  win.picker.shown = FIRST_PAGE;
  win.render();
  const q = win.body.querySelector<HTMLInputElement>("#av-q")!;
  q.focus();
  q.setSelectionRange(caret, caret);
}
