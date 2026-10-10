/** The tool card: shows one tool with a slowly turning before/after illustration. */
import type { ToolDef } from "@/app/tools";
import { fmt } from "@/ui/dom";
import { cardHtml, sliderParam } from "./card-html";
import type { Panel } from "./panel";
import { cardVisible } from "./panel";
import { runDemo } from "@/render/preview/demo";
import { draw, fitBoth } from "@/render/preview/draw";
import { blockedBy } from "./usability";

const FRAME_MS = 66;
const TURN_SPEED = 0.6;
const TURN_RANGE_RAD = 0.6;
const MAX_DPR = 2;
const MIN_CANVAS_PX = 64;
const HOVER_OPEN_MS = 320;
const HOVER_CLOSE_MS = 250;
const POP_MARGIN_PX = 8;

function sliderValue(p: Panel, t: ToolDef): number {
  const param = sliderParam(t);
  if (!param) return 0;
  return p.preview.over[param.key] ?? t.demo?.params?.[param.key] ?? param.def;
}

export function renderCard(p: Panel): void {
  const t = p.tool(p.st.id);
  if (!t) {
    p.card.innerHTML = "";
    return;
  }
  const demo = runDemo(t, p.preview.over);
  p.preview.demo = demo;
  p.card.innerHTML = cardHtml(t, {
    pinned: p.deps.prefs.pinned.includes(t.id),
    reason: blockedBy(p.deps.store, t),
    hasPreview: !!demo.after?.mesh.v.length,
    single: !demo.before,
    sliderValue: sliderValue(p, t),
    related: (t.related ?? []).map((id) => p.tool(id)).filter((r): r is ToolDef => !!r),
  });
  sizeCanvases(p);
  paint(p, 0);
}

export function sizeCanvases(p: Panel): void {
  const dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
  for (const c of p.card.querySelectorAll("canvas")) {
    const r = c.getBoundingClientRect();
    c.width = Math.max(MIN_CANVAS_PX, Math.round(r.width * dpr));
    c.height = Math.max(MIN_CANVAS_PX, Math.round(r.height * dpr));
  }
}

export function paint(p: Panel, angle: number): void {
  const demo = p.preview.demo;
  if (!demo?.after) return;
  const fit = fitBoth(demo.before?.mesh ?? null, demo.after.mesh);
  const before = p.card.querySelector<HTMLCanvasElement>("#pv-before");
  const after = p.card.querySelector<HTMLCanvasElement>("#pv-after");
  if (before && demo.before) draw(before, demo.before.mesh, demo.before.selection, angle, fit);
  if (after) draw(after, demo.after.mesh, demo.after.selection, angle, fit);
}

export const currentAngle = (p: Panel): number => Math.sin(p.preview.turn * TURN_SPEED) * TURN_RANGE_RAD;

/** the illustration turns back and forth while the card is visible, about 15 frames a second */
export function ensureSpin(p: Panel): void {
  const pv = p.preview;
  if (pv.spinning || !cardVisible(p)) return;
  pv.spinning = true;
  const loop = (now: number) => {
    if (!cardVisible(p)) {
      pv.spinning = false;
      pv.lastFrame = 0;
      return;
    }
    if (now - pv.lastFrame > FRAME_MS) {
      pv.turn += (now - (pv.lastFrame || now)) / 1000;
      pv.lastFrame = now;
      paint(p, currentAngle(p));
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export function selectTool(p: Panel, id: string, showCard: boolean): void {
  p.st.id = id;
  p.preview.over = {};
  for (const x of p.list.querySelectorAll<HTMLElement>(".citem")) {
    x.setAttribute("aria-selected", String(x.dataset.id === id));
  }
  if (!showCard) return;
  renderCard(p);
  ensureSpin(p);
}

/** the card's slider changes the illustration's main parameter */
export function onSlider(p: Panel, value: number): void {
  const t = p.tool(p.st.id);
  const param = t && sliderParam(t);
  if (!t || !param) return;
  p.preview.over = { [param.key]: value };
  p.card.querySelector("#pv-out")!.textContent = fmt(value, param.decimals ?? 2);
  p.preview.demo = runDemo(t, p.preview.over);
  paint(p, currentAngle(p));
}

/** narrow panel: hovering a row pops the card out next to it, after a moment */
export function popoverFor(p: Panel, row: HTMLElement | null): void {
  clearTimeout(p.preview.hoverTimer);
  if (p.st.wide) {
    if (row) selectTool(p, row.dataset.id!, true);
    return;
  }
  if (!row) {
    p.preview.hoverTimer = window.setTimeout(() => p.card.classList.remove("pop"), HOVER_CLOSE_MS);
    return;
  }
  p.preview.hoverTimer = window.setTimeout(() => {
    selectTool(p, row.dataset.id!, true);
    p.card.classList.add("pop");
    const r = row.getBoundingClientRect();
    const s = p.side.getBoundingClientRect();
    const top = Math.min(r.top - s.top - 10, s.height - p.card.offsetHeight - POP_MARGIN_PX);
    p.card.style.top = Math.max(4, top) + "px";
    ensureSpin(p);
  }, HOVER_OPEN_MS);
}
