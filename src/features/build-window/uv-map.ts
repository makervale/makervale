/** The UV layout picture on the Material tab: the unwrapped edges, selected faces filled in yellow. */
import { hasUV } from "@/lib/mesh/mesh";
import { uvSegments } from "@/lib/mesh/uv";
import type { Obj } from "@/world/model";

const BACKGROUND = "#1d1d1d";
const GRID = "#333";
const EDGES = "#4dd1ff";
const SELECTED = "rgba(255,216,74,.45)";
const GRID_LINES = 4;

function grid(g: CanvasRenderingContext2D, w: number): void {
  g.strokeStyle = GRID;
  for (let i = 1; i < GRID_LINES; i++) {
    const x = (i * w) / GRID_LINES;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, w);
    g.moveTo(0, x);
    g.lineTo(w, x);
    g.stroke();
  }
}

function edges(g: CanvasRenderingContext2D, o: Obj, w: number): void {
  const seg = uvSegments(o.mesh);
  g.strokeStyle = EDGES;
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i + 3 < seg.length; i += 4) {
    g.moveTo(seg[i] * w, (1 - seg[i + 1]) * w);
    g.lineTo(seg[i + 2] * w, (1 - seg[i + 3]) * w);
  }
  g.stroke();
}

function faces(g: CanvasRenderingContext2D, o: Obj, selected: Set<number>, w: number): void {
  g.fillStyle = SELECTED;
  for (const f of selected) {
    const corners = o.mesh.uv?.[f];
    if (!corners) continue;
    g.beginPath();
    corners.forEach(([u, v], k) => (k ? g.lineTo(u * w, (1 - v) * w) : g.moveTo(u * w, (1 - v) * w)));
    g.closePath();
    g.fill();
  }
}

export function drawUV(canvas: HTMLCanvasElement | null, o: Obj | undefined, selectedFaces: Set<number>): void {
  if (!canvas || !o || !hasUV(o.mesh)) return;
  const g = canvas.getContext("2d")!;
  const w = canvas.width;
  g.fillStyle = BACKGROUND;
  g.fillRect(0, 0, w, w);
  grid(g, w);
  edges(g, o, w);
  faces(g, o, selectedFaces, w);
}
