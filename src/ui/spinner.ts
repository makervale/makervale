/**
 * A number field: arrows step it (hold to repeat), dragging the label scrubs it, typing sets it.
 * Each spinner has a key "prefix:rest"; the handler registered for the prefix gets every change.
 */
import { clamp, esc, fmt, parseNum } from "./dom";

export type SpinPhase = "start" | "live" | "end";
export type SpinHandler = (key: string, value: number, phase: SpinPhase) => void;

export interface SpinOptions {
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  /** colours the label as an axis: 0 x, 1 y, 2 z */
  axis?: number;
  disabled?: boolean;
  aria?: string;
}

const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 60;
const SCRUB_DEAD_ZONE_PX = 3;
const SCRUB_PX_PER_STEP = 2;
const SCRUB_FAST = 10;
const handlers = new Map<string, SpinHandler>();

export function onSpin(prefix: string, handler: SpinHandler): void {
  handlers.set(prefix, handler);
}

const UP = `<svg viewBox="0 0 7 5" fill="currentColor"><path d="M3.5 0 7 5H0z"/></svg>`;
const DOWN = `<svg viewBox="0 0 7 5" fill="currentColor"><path d="M3.5 5 0 0h7z"/></svg>`;

function dataAttributes(key: string, o: SpinOptions): string {
  return `data-spin="${key}" data-min="${o.min ?? -1e9}" data-max="${o.max ?? 1e9}" data-step="${o.step ?? 0.01}"`;
}

export function spinner(key: string, label: string, value: number, o: SpinOptions = {}): string {
  const decimals = o.decimals ?? 3;
  const axis = o.axis !== undefined ? "ax" + o.axis : "";
  const data = dataAttributes(key, o);
  const arrows =
    `<button type="button" data-d="1" tabindex="-1" aria-label="More">${UP}</button>` +
    `<button type="button" data-d="-1" tabindex="-1" aria-label="Less">${DOWN}</button>`;
  const shown = o.disabled ? "" : fmt(value, decimals);
  const input = `<input id="sp-${key.replace(/[^\w-]/g, "_")}" inputmode="decimal" value="${shown}"
    ${o.disabled ? "disabled" : ""} aria-label="${esc(o.aria || label || key)}">`;
  return `<div class="spin${o.disabled ? " dis" : ""}" ${data} data-dec="${decimals}">
    <label class="${axis}" ${label ? "" : "hidden"}>${label}</label><div class="arr">${arrows}</div>${input}</div>`;
}

const inputOf = (box: HTMLElement): HTMLInputElement => box.querySelector("input")!;
const valueOf = (box: HTMLElement): number => parseNum(inputOf(box).value);

function setValue(box: HTMLElement, v: number, phase: SpinPhase): void {
  const key = box.dataset.spin!;
  const value = clamp(v, +box.dataset.min!, +box.dataset.max!);
  inputOf(box).value = fmt(value, +box.dataset.dec!);
  handlers.get(key.split(":")[0])?.(key, value, phase);
}

function holdArrow(button: HTMLElement, e: PointerEvent): void {
  const box = button.closest<HTMLElement>(".spin")!;
  const step = +box.dataset.step! * +button.dataset.d!;
  e.preventDefault();
  const start = valueOf(box);
  let n = 0;
  setValue(box, start, "start");
  const tick = () => setValue(box, start + step * ++n, "live");
  tick();
  let repeat = 0;
  const delay = setTimeout(() => (repeat = window.setInterval(tick, REPEAT_EVERY_MS)), REPEAT_DELAY_MS);
  const up = () => {
    clearTimeout(delay);
    clearInterval(repeat);
    setValue(box, valueOf(box), "end");
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointerup", up);
}

function scrubLabel(label: HTMLElement, e: PointerEvent): void {
  const box = label.closest<HTMLElement>(".spin")!;
  if (box.classList.contains("dis")) return;
  e.preventDefault();
  const start = valueOf(box);
  const step = +box.dataset.step!;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - e.clientX;
    if (!moved && Math.abs(dx) < SCRUB_DEAD_ZONE_PX) return;
    if (!moved) setValue(box, start, "start");
    moved = true;
    setValue(box, start + Math.round(dx / SCRUB_PX_PER_STEP) * step * (ev.shiftKey ? SCRUB_FAST : 1), "live");
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (moved) setValue(box, valueOf(box), "end");
    else inputOf(box).focus();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function typed(e: Event): void {
  const t = e.target as HTMLElement;
  const box = t.closest<HTMLElement>(".spin");
  if (!box || t.tagName !== "INPUT") return;
  const v = parseNum((t as HTMLInputElement).value);
  if (!isFinite(v)) return;
  setValue(box, v, "start");
  setValue(box, v, "end");
}

export function initSpinners(): void {
  document.addEventListener("pointerdown", (e) => {
    const t = e.target as HTMLElement;
    const arrow = t.closest<HTMLElement>(".spin .arr button");
    const label = t.closest<HTMLElement>(".spin > label");
    if (arrow) holdArrow(arrow, e);
    else if (label) scrubLabel(label, e);
  });
  document.addEventListener("change", typed);
  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (e.key === "Enter" && t.closest(".spin")) t.blur();
  });
}
