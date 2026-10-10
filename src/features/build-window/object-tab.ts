/** Object tab: name, position (or selection centre), size, rotation, mesh statistics, measurements. */
import * as THREE from "three";
import { selectedFaces } from "@/lib/mesh/selection";
import { inspect } from "@/lib/mesh/validate";
import type { Vec3 } from "@/lib/vec";
import type { Obj } from "@/world/model";
import { esc, fmt } from "@/ui/dom";
import { spinner } from "@/ui/spinner";
import type { Build } from "./context";
import { measure } from "./measure";

const DEG = Math.PI / 180;
const XYZ = ["X", "Y", "Z"];

/** rotation as XYZ Euler angles in degrees */
export function eulerOf(o: Obj): Vec3 {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(o.quat), "XYZ");
  return [e.x / DEG, e.y / DEG, e.z / DEG];
}

export function quatOfEuler(deg: Vec3): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg[0] * DEG, deg[1] * DEG, deg[2] * DEG, "XYZ"));
  return [q.x, q.y, q.z, q.w];
}

function row3(prefix: string, values: number[], opts: Parameters<typeof spinner>[3]): string {
  return values.map((v, i) => spinner(`${prefix}:${i}`, XYZ[i], v, { ...opts, axis: i })).join("");
}

function transformHtml(b: Build, objs: Obj[], one: Obj | null): string {
  const editing = !!b.deps.store.editTarget();
  const p = b.deps.manipulators.pivotOf(objs).toArray();
  let h = `<h4>${editing ? "Selection center" : "Position"} <span>m</span></h4><div class="xyz">${row3("pos", p, { step: 0.01 })}</div>`;
  if (editing) return h;
  const size = one ? one.size : [0, 0, 0];
  const rot = one ? eulerOf(one) : [0, 0, 0];
  h += `<h4>Size <span>object scale, m</span></h4><div class="xyz">${row3("size", size, { min: 0.001, max: 1000, step: 0.01, disabled: !one })}</div>`;
  h += `<h4>Rotation <span>degrees</span></h4><div class="xyz">${row3("rot", rot, { min: -9999, max: 9999, step: 1, decimals: 2, disabled: !one })}</div>`;
  return h;
}

function meshHtml(b: Build, one: Obj): string {
  const rep = inspect(one.mesh);
  const stat = (n: number, label: string) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
  const grid =
    stat(rep.verts, "verts") + stat(rep.edges, "edges") + stat(rep.faces, "faces") + stat(rep.tris, "triangles");
  const h = `<h4>Mesh <span>${rep.closed ? "closed" : rep.open.length + " open edges"}</span></h4><div class="stats-grid">${grid}</div>`;
  const s = b.deps.store.selection.elements;
  if (b.deps.store.editTarget()) {
    const faces = selectedFaces(one.mesh, s).size;
    return (
      h +
      `<div class="note">Selected: ${s.verts.size} verts, ${s.edges.size} edges, ${faces} faces</div>${measure(b, one)}`
    );
  }
  return (
    h +
    '<div class="row" style="gap:4px;flex-wrap:wrap"><button class="btn small" data-mode="auto">Edit mesh (2)</button>' +
    '<button class="btn small" data-run="origin">Set pivot</button><button class="btn small" data-run="ground">Drop to ground</button></div>'
  );
}

export function objectTab(b: Build, objs: Obj[]): string {
  const one = objs.length === 1 ? objs[0] : null;
  const head = one
    ? `<div class="row"><input class="tf" id="ob-name" value="${esc(one.name)}" aria-label="Object name"></div>`
    : `<div class="note">${objs.length} objects</div>`;
  return head + transformHtml(b, objs, one) + (one ? meshHtml(b, one) : "");
}

/** while something is dragged, the numbers follow without rebuilding the tab (and never under the cursor) */
export function liveObjectTab(b: Build): void {
  const { store, manipulators } = b.deps;
  const objs = store.selected();
  if (b.tab !== "obj" || !objs.length) return;
  const set = (key: string, v: number, decimals = 3) => {
    const input = b.root.querySelector<HTMLInputElement>(`[data-spin="${key}"] input`);
    if (input && document.activeElement !== input) input.value = fmt(v, decimals);
  };
  manipulators
    .pivotOf(objs)
    .toArray()
    .forEach((v, i) => set("pos:" + i, v));
  if (objs.length !== 1 || store.editTarget()) return;
  objs[0].size.forEach((v, i) => set("size:" + i, v));
  eulerOf(objs[0]).forEach((v, i) => set("rot:" + i, v, 2));
}
