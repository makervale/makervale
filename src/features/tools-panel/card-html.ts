/** The tool card's markup: name, summary, before/after preview, how to use, parameters, related tools. */
import type { ParamDef, ToolDef } from "@/app/tools";
import { esc, fmt } from "@/ui/dom";
import { liveNote } from "./usability";

export interface CardFacts {
  pinned: boolean;
  /** why it can't be used now */
  reason: string | null;
  hasPreview: boolean;
  /** create tools have no "before" */
  single: boolean;
  /** the slider's current value */
  sliderValue: number;
  related: ToolDef[];
}

const SLIDER_RANGE = 4;

export const sliderParam = (t: ToolDef): ParamDef | undefined => (t.params ?? []).find((p) => !p.options);

function previewHtml(f: CardFacts): string {
  if (!f.hasPreview) return "";
  const before = f.single ? "" : '<figure><figcaption>Before</figcaption><canvas id="pv-before"></canvas></figure>';
  const after = `<figure><figcaption>${f.single ? "Result" : "After"}</figcaption><canvas id="pv-after"></canvas></figure>`;
  return `<div class="pv ${f.single ? "one" : ""}">${before}${after}</div>`;
}

function sliderHtml(t: ToolDef, f: CardFacts): string {
  const p = sliderParam(t);
  if (!f.hasPreview || !p) return "";
  const max = Math.min(p.max, p.def * SLIDER_RANGE || p.max);
  return (
    `<div class="pv-slider"><label for="pv-param">${esc(p.label)}</label>` +
    `<input type="range" id="pv-param" min="${p.min}" max="${max}" step="${p.step}" value="${f.sliderValue}">` +
    `<output id="pv-out">${fmt(f.sliderValue, p.decimals ?? 2)}</output></div>`
  );
}

function needHtml(t: ToolDef, f: CardFacts): string {
  if (t.kind === "option") {
    const on = !!t.isOn?.();
    return `<div class="need ${on ? "ok" : "no"}">${on ? "On" : "Off"}</div>`;
  }
  if (t.kind === "create" || t.kind === "mode") return "";
  if (f.reason) return `<div class="need no">${esc(f.reason)}</div>`;
  const note = liveNote(t);
  const text = t.live
    ? "Ready to use in the view" + (note ? ": " + esc(note) : "") + ". Click confirms, Esc takes it back."
    : "You can use it now, on the current selection.";
  return `<div class="need ok">${text}</div>`;
}

function useLabel(t: ToolDef): string {
  if (t.kind === "option") return t.isOn?.() ? "Turn off" : "Turn on";
  if (t.kind === "create") return "Create";
  return t.live ? "Start tool" : "Use";
}

function actionsHtml(t: ToolDef): string {
  const example =
    t.demo && t.kind !== "create" && t.kind !== "option"
      ? '<button class="btn" id="cat-try" title="Adds the scene from the illustration to the world and selects the same as in the picture">Try on an example</button>'
      : "";
  return `<div class="cat-actions"><button class="btn primary" id="cat-use">${useLabel(t)}</button>${example}</div>`;
}

function paramsHtml(t: ToolDef): string {
  if (!t.params?.length) return "";
  const range = (p: ParamDef) =>
    p.options
      ? p.options.map(esc).join(" / ")
      : `${p.min}–${p.max}${p.unit ? " " + esc(p.unit) : ""}, default ${p.def}`;
  const rows = t.params.map((p) => `<dt>${esc(p.label)}</dt><dd>${range(p)}${p.help ? ". " + esc(p.help) : ""}</dd>`);
  const where = t.live
    ? "Set them with the mouse in the view, and after confirming, in the last-operation panel."
    : "After use, change them in the last-operation panel in the Build window.";
  return `<div class="k">Parameters</div><div class="params"><dl>${rows.join("")}</dl></div><div class="note">${where}</div>`;
}

function relatedHtml(f: CardFacts): string {
  if (!f.related.length) return "";
  const links = f.related.map((r) => `<button data-go="${r.id}">${esc(r.name)}</button>`).join("");
  return `<div class="k">See also</div><div class="rel">${links}</div>`;
}

export function cardHtml(t: ToolDef, f: CardFacts): string {
  const key = t.key ? ` <kbd>${esc(t.key)}</kbd>` : "";
  const star = `<button class="star ${f.pinned ? "on" : ""}" data-pin="${t.id}" title="Pin to the At hand bar">★</button>`;
  return `
    <h3>${esc(t.name)}${key}<span style="flex:1"></span>${star}</h3>
    <div class="sum">${esc(t.summary)}</div>
    ${previewHtml(f)}
    ${sliderHtml(t, f)}
    ${needHtml(t, f)}
    ${actionsHtml(t)}
    <div class="k">How to use</div><ol>${t.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    ${paramsHtml(t)}
    ${relatedHtml(f)}
    <div class="note">Also found as: ${t.synonyms.slice(0, 6).map(esc).join(", ")}</div>`;
}
