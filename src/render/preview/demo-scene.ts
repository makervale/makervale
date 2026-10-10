/** The little scene a preview is drawn from: the mesh, its edges, and the selection in yellow. */
import * as THREE from "three";
import type { Mesh } from "@/lib/mesh/mesh";
import { parseEdgeKey } from "@/lib/mesh/mesh";
import type { ElementSelection } from "@/lib/mesh/selection";
import { topologyOf } from "@/lib/mesh/topology";
import { buildGeometry, infoOf } from "../geometry";

const SELECTED = "#ffd84a";
const BASE_COLOR = 0xd8d2c4;
const SLOT_COLORS = [0xc77a52, 0x5b8fbf, 0x7fa86a, 0xd9a441];
const SMOOTH_DEG = 40;
const POINT_PX = 7;
const UNIT: [number, number, number] = [1, 1, 1];

function positions(points: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return g;
}

function edgeLines(m: Mesh, keys: Iterable<string>): number[] {
  const p: number[] = [];
  for (const k of keys) {
    const [a, b] = parseEdgeKey(k);
    if (m.v[a] && m.v[b]) p.push(...m.v[a], ...m.v[b]);
  }
  return p;
}

function surface(m: Mesh): THREE.Mesh {
  const g = buildGeometry(m, SMOOTH_DEG, UNIT);
  const info = infoOf(g);
  const side = info.open ? THREE.DoubleSide : THREE.FrontSide;
  const materials = Array.from({ length: info.slots || 1 }, (_, i) => {
    const color = i === 0 ? BASE_COLOR : SLOT_COLORS[(i - 1) % SLOT_COLORS.length];
    const offset = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
    return new THREE.MeshStandardMaterial({ color, roughness: 0.7, side, ...offset });
  });
  return new THREE.Mesh(g, materials);
}

function selectedFaces(m: Mesh, faces: Set<number>): THREE.Mesh {
  const pos: number[] = [];
  for (const fi of faces) {
    const p = m.f[fi];
    if (!p) continue;
    for (let i = 1; i < p.length - 1; i++) pos.push(...m.v[p[0]], ...m.v[p[i]], ...m.v[p[i + 1]]);
  }
  const material = new THREE.MeshBasicMaterial({
    color: SELECTED,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  return new THREE.Mesh(positions(pos), material);
}

function selectedVerts(m: Mesh, verts: Set<number>): THREE.Points {
  const pos: number[] = [];
  for (const i of verts) if (m.v[i]) pos.push(...m.v[i]);
  const material = new THREE.PointsMaterial({
    color: SELECTED,
    size: POINT_PX,
    sizeAttenuation: false,
    depthTest: false,
  });
  return new THREE.Points(positions(pos), material);
}

/** fill `root` with the mesh and its selection */
export function addMesh(root: THREE.Group, m: Mesh, s: ElementSelection): void {
  root.add(surface(m));
  const edges = positions(edgeLines(m, topologyOf(m).edges.keys()));
  root.add(
    new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.7 })),
  );
  if (s.faces.size) root.add(selectedFaces(m, s.faces));
  if (s.edges.size) {
    const lines = positions(edgeLines(m, s.edges));
    root.add(new THREE.LineSegments(lines, new THREE.LineBasicMaterial({ color: SELECTED, depthTest: false })));
  }
  if (s.verts.size) root.add(selectedVerts(m, s.verts));
}

export function clearGroup(root: THREE.Group): void {
  for (const c of [...root.children]) {
    root.remove(c);
    c.traverse((n) => {
      if (n instanceof THREE.Mesh || n instanceof THREE.LineSegments || n instanceof THREE.Points) n.geometry.dispose();
    });
  }
}
