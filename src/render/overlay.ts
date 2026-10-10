/** The element overlay of the object being edited: its wireframe, vertices, and the selected elements. */
import * as THREE from "three";
import type { Mesh } from "@/lib/mesh/mesh";
import { edgeKey } from "@/lib/mesh/mesh";
import type { EditMode, ElementSelection } from "@/lib/mesh/selection";
import type { Adjacency } from "./adjacency";
import { edgeLines, faceFill, faceTriangles, pointsMaterial, positions, vertexPoints } from "./element-shapes";
import type { Theme } from "./theme";

export interface OverlayInput {
  mesh: Mesh;
  adjacency: Adjacency;
  selection: ElementSelection;
  mode: EditMode;
  theme: Theme;
}

const VERTEX_SIZE = { vert: 6, auto: 4 };
const SELECTED_VERTEX_SIZE = 9;

function wireframe(m: Mesh, adjacency: Adjacency): THREE.LineSegments {
  const material = new THREE.LineBasicMaterial({
    color: 0x111111,
    transparent: true,
    opacity: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const wire = new THREE.LineSegments(positions(edgeLines(m, adjacency.edges.keys())), material);
  wire.renderOrder = 4;
  return wire;
}

function unselectedVertices(m: Mesh, s: ElementSelection, mode: "vert" | "auto"): THREE.Points {
  const ids = m.v.map((_, i) => i).filter((i) => !s.verts.has(i));
  const pts = new THREE.Points(positions(vertexPoints(m, ids)), pointsMaterial("#111111", VERTEX_SIZE[mode]));
  pts.renderOrder = 5;
  return pts;
}

/** the edges around the selected faces */
function faceOutlineKeys(m: Mesh, faces: Set<number>): Set<string> {
  const keys = new Set<string>();
  for (const fi of faces) {
    const face = m.f[fi];
    if (face) face.forEach((a, k) => keys.add(edgeKey(a, face[(k + 1) % face.length])));
  }
  return keys;
}

function selectedFaces(m: Mesh, faces: Set<number>, theme: Theme): THREE.Object3D[] {
  const fill = new THREE.Mesh(positions(faceTriangles(m, faces)), faceFill(theme.root, 0.38, 2));
  fill.renderOrder = 5;
  const lines = new THREE.LineSegments(
    positions(edgeLines(m, faceOutlineKeys(m, faces))),
    new THREE.LineBasicMaterial({ color: theme.root }),
  );
  lines.renderOrder = 6;
  return [fill, lines];
}

function selectedEdges(m: Mesh, edges: Set<string>, theme: Theme): THREE.LineSegments {
  const lines = new THREE.LineSegments(
    positions(edgeLines(m, edges)),
    new THREE.LineBasicMaterial({ color: theme.root, depthTest: false }),
  );
  lines.renderOrder = 7;
  return lines;
}

function selectedVertices(m: Mesh, verts: Set<number>, theme: Theme): THREE.Points {
  const pts = new THREE.Points(
    positions(vertexPoints(m, verts)),
    pointsMaterial(theme.root, SELECTED_VERTEX_SIZE, false),
  );
  pts.renderOrder = 8;
  return pts;
}

export function buildOverlay({ mesh: m, adjacency, selection: s, mode, theme }: OverlayInput): THREE.Group {
  const group = new THREE.Group();
  group.add(wireframe(m, adjacency));
  if (mode === "vert" || mode === "auto") group.add(unselectedVertices(m, s, mode));
  if (s.faces.size) group.add(...selectedFaces(m, s.faces, theme));
  if (s.edges.size) group.add(selectedEdges(m, s.edges, theme));
  if (s.verts.size) group.add(selectedVertices(m, s.verts, theme));
  return group;
}
