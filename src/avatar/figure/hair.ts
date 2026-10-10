/** The built-in figure's hair styles, attached to its head joint. */
import * as THREE from "three";
import type { HairStyle } from "../look";
import { ball, part } from "./parts";

const CURL_COUNT = 14;

/** a cap over the crown and the back of the head, leaving the forehead and face free */
function cap(m: THREE.Material, k = 1): THREE.Mesh {
  const g = new THREE.SphereGeometry(0.112 * k, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
  g.rotateX(Math.PI / 2);
  const x = part(g, m);
  x.scale.set(0.95, 1.05, 1.1);
  x.position.set(0, -0.018, 0.108);
  x.rotation.x = 0.42;
  return x;
}

function curls(head: THREE.Object3D, m: THREE.Material): void {
  head.add(cap(m, 1.03));
  for (let i = 0; i < CURL_COUNT; i++) {
    const a = (i / CURL_COUNT) * Math.PI * 2;
    const c = ball(0.035, m);
    c.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.08 - 0.02, 0.17 + Math.sin(i * 1.7) * 0.02);
    head.add(c);
  }
}

function longBack(m: THREE.MeshStandardMaterial): THREE.Mesh {
  const g = new THREE.CylinderGeometry(0.1, 0.085, 0.24, 18, 1, true, Math.PI * 0.75, Math.PI * 1.5);
  const back = part(g, m);
  back.rotation.x = Math.PI / 2;
  back.position.set(0, -0.015, 0.03);
  back.scale.set(1, 0.9, 1);
  // an open half-cylinder: its inside shows from below
  m.side = THREE.DoubleSide;
  return back;
}

export function addHair(head: THREE.Object3D, style: HairStyle, m: THREE.MeshStandardMaterial): void {
  if (style === "none") return;
  if (style === "short") {
    head.add(cap(m));
    return;
  }
  if (style === "curly") {
    curls(head, m);
    return;
  }
  head.add(cap(m, 1.02));
  if (style === "long") head.add(longBack(m));
  if (style === "bun") {
    const bun = ball(0.05, m);
    bun.position.set(0, -0.09, 0.19);
    head.add(bun);
  }
}
