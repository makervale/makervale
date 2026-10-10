/** Material tab: the object's material slots, the chosen one's settings, and its UV layout. */
import { hasUV } from "@/lib/mesh/mesh";
import { selectedFaces } from "@/lib/mesh/selection";
import { uvStretch } from "@/lib/mesh/uv";
import type { Material, Obj } from "@/world/model";
import { PATTERNS } from "@/render/textures";
import { esc, fmt } from "@/ui/dom";
import { spinner } from "@/ui/spinner";
import type { Build } from "./context";

const facesWith = (o: Obj, slot: number): number => o.mesh.fm.filter((s) => s === slot).length;

/**
 * The object's materials, one per slot its mesh uses. A mesh may refer to slots the object has no material for yet:
 * those show as copies of the first, the way `ensureMaterialSlots` adds them when the material is edited.
 */
export function slotsOf(o: Obj): Material[] {
  const out = o.materials.slice();
  const highest = Math.max(0, ...o.mesh.fm);
  while (out.length <= highest) out.push({ ...out[0], name: `Material ${out.length + 1}` });
  return out;
}

/** the slot to edit: the material of the first selected face, else the one picked in the list */
export function currentSlot(b: Build, o: Obj): number {
  const faces = b.deps.store.editTarget() ? selectedFaces(o.mesh, b.deps.store.selection.elements) : new Set<number>();
  if (faces.size) b.matSlot = o.mesh.fm[[...faces][0]];
  if (b.matSlot >= slotsOf(o).length) b.matSlot = 0;
  return b.matSlot;
}

function slotList(o: Obj, slot: number): string {
  const rows = slotsOf(o).map(
    (x, i) =>
      `<div class="matrow" data-slot="${i}" aria-selected="${i === slot}"><span class="dot" style="background:${x.color}"></span>` +
      `<span class="n">${esc(x.name)}</span><span class="c">${facesWith(o, i)} faces</span></div>`,
  );
  return `<div class="matlist">${rows.join("")}</div>`;
}

function slotButtons(o: Obj, slot: number, selectedFaceCount: number): string {
  const assign = selectedFaceCount
    ? `<button class="btn small" id="mt-assign">Assign to selected (${selectedFaceCount})</button>`
    : "";
  const del =
    slotsOf(o).length > 1 && !facesWith(o, slot) ? '<button class="btn small" id="mt-del">Delete</button>' : "";
  return `<div class="row" style="gap:4px;flex-wrap:wrap">${assign}<button class="btn small" id="mt-new">New</button><button class="btn small" id="mt-select">Select faces</button>${del}</div>`;
}

function settingsHtml(m: Material): string {
  const pct = (k: string, label: string, v: number) =>
    `<div class="row"><span class="lbl w">${label}</span>${spinner("mat:" + k, "", v * 100, { min: 0, max: 100, step: 5, decimals: 0, aria: label })}<span class="lbl">%</span></div>`;
  const patterns = Object.entries(PATTERNS).map(
    ([k, v]) => `<option value="${k}" ${k === m.pattern ? "selected" : ""}>${v}</option>`,
  );
  const repeats = (k: "repU" | "repV", aria: string) =>
    spinner("mat:" + k, "", m[k], { min: 0.05, max: 100, step: 0.25, decimals: 2, aria });
  return `<h4>${esc(m.name)}</h4>
    <div class="row"><input class="tf" id="mt-name" value="${esc(m.name)}" aria-label="Material name"><button class="swatch" style="width:44px;background:${m.color}" title="Color"><input type="color" id="mt-color" value="${m.color}" aria-label="Color"></button></div>
    <div class="row"><span class="lbl w">Pattern</span><select class="cb" id="mt-pattern" style="flex:1">${patterns.join("")}</select></div>
    <div class="row"><span class="lbl w">Repeats U/V</span>${repeats("repU", "Repeats U")}${repeats("repV", "Repeats V")}</div>
    <div class="row"><span class="lbl w">Pattern rotation (°)</span>${spinner("mat:rot", "", m.rot, { min: -360, max: 360, step: 15, decimals: 0, aria: "Pattern rotation" })}</div>
    ${pct("roughness", "Roughness", m.roughness)}${pct("metalness", "Metalness", m.metalness)}${pct("opacity", "Opacity", m.opacity)}${pct("emissive", "Glow", m.emissive)}`;
}

function uvHtml(o: Obj, m: Material): string {
  const custom = hasUV(o.mesh);
  const layout = custom
    ? `<canvas class="uvmap" id="uvmap" width="256" height="256" aria-label="UV layout"></canvas><div class="note">Distortion: ${fmt(uvStretch(o.mesh, o.size), 2)} (0 = none). The material pattern repeats ${m.repU}×${m.repV} across the whole square.</div>`
    : '<div class="note">Textures are projected from three sides in metres. Unwrap UV to paint textures in other programs.</div>';
  const clear = custom ? '<button class="btn small" data-run="uvclear">Clear UV</button>' : "";
  return `<h4>UV layout <span>${custom ? "custom" : "projected from 3 sides"}</span></h4>
    ${layout}
    <div class="row" style="gap:4px;flex-wrap:wrap"><button class="btn small" data-run="uvsmart">Unwrap UV</button><button class="btn small" data-run="uvbox">Cube UV</button><button class="btn small" data-run="uvcyl">Cylinder UV</button>${clear}</div>
    <p class="note">Materials are PBR (glTF) compatible.</p>`;
}

export function materialTab(b: Build, objs: Obj[]): string {
  const one = objs.length === 1 ? objs[0] : null;
  if (!one) return '<div class="empty">Materials are edited for one object at a time.</div>';
  const slot = currentSlot(b, one);
  const faces = b.deps.store.editTarget() ? selectedFaces(one.mesh, b.deps.store.selection.elements).size : 0;
  const m = slotsOf(one)[slot];
  return slotList(one, slot) + slotButtons(one, slot, faces) + settingsHtml(m) + uvHtml(one, m);
}
