/** The tools row (Move, Rotate, Stretch, Create, All tools), the At hand bar, and the status line. */
import type { Manipulator } from "@/app/store";
import { needReason } from "@/app/tool-needs";
import { $, $$, esc } from "@/ui/dom";
import type { Build, Clicks } from "./context";
import { statusText } from "./status";

const SINGLE_POINT = "A single point can only be moved. Shift+drag pulls out a spike.";
const SHORT_KEY = 3;

export function renderTop(b: Build): void {
  const { store, manipulators } = b.deps;
  const one = manipulators.singlePoint();
  const active = store.toolMode === "edit" ? manipulators.effManip() : null;
  for (const btn of $$<HTMLButtonElement>("[data-manip]", b.root)) {
    if (!btn.dataset.t) btn.dataset.t = btn.title;
    btn.setAttribute("aria-pressed", String(active === btn.dataset.manip));
    btn.disabled = one && btn.dataset.manip !== "move";
    btn.title = btn.disabled ? SINGLE_POINT : btn.dataset.t;
  }
  $("[data-create]", b.root).setAttribute("aria-pressed", String(store.toolMode === "create"));
}

function quickButton(b: Build, id: string): string {
  const t = b.deps.runner.tools.get(id);
  if (!t) return "";
  const always = t.kind === "create" || t.kind === "option" || t.kind === "mode";
  const reason = always ? null : needReason(b.deps.store, t.need);
  const key = t.key && t.key.length <= SHORT_KEY ? `<kbd>${esc(t.key)}</kbd>` : "";
  const title = esc(t.summary) + (reason ? "\n— " + esc(reason) : "");
  return `<button class="btn small ${reason ? "na" : ""}" data-run="${id}" title="${title}">${esc(t.name)}${key}</button>`;
}

export function renderQuick(b: Build): void {
  const buttons = b.deps.pins
    .pins()
    .map((id) => quickButton(b, id))
    .join("");
  $("#b-quick", b.root).innerHTML =
    '<div class="r" style="justify-content:space-between"><span class="lbl">At hand</span>' +
    '<button class="btn small" data-open-catalog="pinned" title="Pin tools with the star in the Tools panel">All tools…</button></div>' +
    `<div class="quick">${buttons || '<span class="note">Pin tools with the star in the Tools panel.</span>'}</div>`;
}

export function renderStatus(b: Build): void {
  const { store, runner, manipulators } = b.deps;
  const el = $("#b-status", b.root);
  if (!el) return;
  el.textContent = statusText(store, manipulators, runner.tools.get(store.createType)?.name ?? "");
  renderTop(b);
}

export const TOOLBAR_CLICKS: Clicks = [
  ["[data-manip]", (b, el) => b.deps.commands.setToolMode("edit", el.dataset.manip as Manipulator)],
  ["[data-create]", (b) => b.deps.commands.setToolMode(b.deps.store.toolMode === "create" ? "edit" : "create")],
  ["[data-open-catalog]", (b) => b.deps.bus.emit("menu:command", { command: "catalog" })],
  ["[data-run]", (b, el) => b.deps.bus.emit("tool:use", { id: el.dataset.run! })],
];
