/** What the active tool shows: the reminder chip at the top, the value badge at the cursor, its helper plane. */
import * as THREE from "three";
import { esc, fmt } from "@/ui/dom";
import type { LiveEnv } from "./env";
import { paramDef } from "./env";

const HELPER_OPACITY = 0.18;

/** the chip: what the mouse, the wheel and the keys do now */
export function banner(env: LiveEnv): void {
  const L = env.live;
  if (!L) return;
  const spec = L.tool.live!;
  const parts: string[] = [];
  if (L.phase === "pick") {
    parts.push(
      spec.pick === "knife"
        ? "Click edges or vertices to guide the cut. Enter finishes, Esc takes it back."
        : "Click the edge the cut should go through.",
    );
  } else {
    const d = paramDef(L.tool, spec.param);
    const w = paramDef(L.tool, spec.wheel);
    const ctrl = env.store.modifiers.ctrl;
    if (d) parts.push(`mouse: ${d.label.toLowerCase()}${ctrl ? "" : " (Ctrl: steps)"}`);
    if (w) parts.push(`wheel: ${w.label.toLowerCase()}`);
    parts.push("digits: exact value", "click / Enter: confirm", "Esc: take back");
  }
  env.chip.innerHTML = `<b>${esc(L.tool.name)}</b> · ${parts.join(" · ")}`;
  env.chip.hidden = false;
}

/** the badge: the values being adjusted */
export function badge(env: LiveEnv): void {
  const L = env.live;
  if (!L || L.phase !== "adjust") return;
  const spec = L.tool.live!;
  const d = paramDef(L.tool, spec.param);
  const w = paramDef(L.tool, spec.wheel);
  const bits: string[] = [];
  if (d) {
    const value = L.buf ? L.buf + "…" : fmt(L.p[d.key], d.decimals ?? 2);
    bits.push(`${d.label} ${value}${d.unit ? " " + d.unit : ""}`);
  }
  if (w) bits.push(`${w.label} ${fmt(L.p[w.key], w.decimals ?? 0)}`);
  if (!bits.length) bits.push("click confirms");
  env.manip.showBadge(env.cursor.x, env.cursor.y, bits.join(" · "), env.store.modifiers.ctrl);
}

function clearHelper(env: LiveEnv): void {
  for (const c of [...env.helper.children]) {
    env.helper.remove(c);
    c.traverse((n) => (n as THREE.Mesh).geometry?.dispose());
  }
}

/** the tool's helper for the current parameters, e.g. the plane a bisect cuts along */
export function drawHelper(env: LiveEnv): void {
  clearHelper(env);
  const L = env.live;
  const make = L?.tool.live?.helper;
  if (!L || L.phase !== "adjust" || !make) return;
  const h = make(env.runner.context(), L.p);
  if (!h) return;
  const accent = env.renderer.theme.accent;
  const g = new THREE.PlaneGeometry(h.r * 2, h.r * 2);
  const fill = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: HELPER_OPACITY });
  Object.assign(fill, { side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  const plane = new THREE.Mesh(g, fill);
  plane.position.fromArray(h.p);
  plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().fromArray(h.n).normalize());
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(g),
    new THREE.LineBasicMaterial({ color: accent, depthTest: false }),
  );
  plane.add(edge);
  env.helper.add(plane);
}

/** the tool is done: take everything it showed away */
export function clearFeedback(env: LiveEnv): void {
  env.manip.hideBadge();
  env.chip.hidden = true;
  env.renderer.preselect.clear();
  clearHelper(env);
}
