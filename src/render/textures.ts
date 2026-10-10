/** Procedural textures, drawn light grey so the material colour tints them. */
import * as THREE from "three";
import type { Material } from "@/world/model";

export const PATTERNS: Record<string, string> = {
  none: "None",
  plank: "Planks",
  brick: "Bricks",
  tile: "Tiles",
  check: "Checker",
  stone: "Stone",
  concrete: "Concrete",
  uvgrid: "UV test grid",
};

const SIZE = 256;
type Ctx = CanvasRenderingContext2D;
type Rand = () => number;

/** a fixed seed, so every browser draws the same pattern */
function seededRandom(seed: number): Rand {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const grey = (shade: number, alpha?: number): string =>
  alpha === undefined ? `rgb(${shade},${shade},${shade})` : `rgba(${shade},${shade},${shade},${alpha})`;

function planks(g: Ctx, R: Rand): void {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = grey(225 + Math.floor(R() * 25));
    g.fillRect(0, i * 32, SIZE, 32);
    g.strokeStyle = "rgba(0,0,0,.08)";
    for (let k = 0; k < 6; k++) {
      const y = i * 32 + 4 + R() * 24;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(80, y + R() * 6 - 3, 170, y + R() * 6 - 3, SIZE, y);
      g.stroke();
    }
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(0, i * 32, SIZE, 2);
    g.fillRect((i * 97) % SIZE, i * 32, 2, 32);
  }
}

function bricks(g: Ctx, R: Rand): void {
  g.fillStyle = "#9a9a9a";
  g.fillRect(0, 0, SIZE, SIZE);
  for (let r = 0; r < 8; r++) {
    for (let k = -1; k < 4; k++) {
      g.fillStyle = grey(205 + Math.floor(R() * 45));
      g.fillRect(k * 64 + (r % 2) * 32 + 3, r * 32 + 3, 58, 26);
    }
  }
}

function tiles(g: Ctx, R: Rand): void {
  g.fillStyle = "#a8a8a8";
  g.fillRect(0, 0, SIZE, SIZE);
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 4; k++) {
      g.fillStyle = grey(236 + Math.floor(R() * 16));
      g.fillRect(k * 64 + 3, r * 64 + 3, 58, 58);
    }
  }
}

function checker(g: Ctx, dark: string, light: string): void {
  for (let r = 0; r < 8; r++) {
    for (let k = 0; k < 8; k++) {
      g.fillStyle = (r + k) % 2 ? dark : light;
      g.fillRect(k * 32, r * 32, 32, 32);
    }
  }
}

function stone(g: Ctx, R: Rand): void {
  for (let i = 0; i < 260; i++) {
    g.fillStyle = grey(190 + Math.floor(R() * 60), 0.55);
    g.beginPath();
    g.arc(R() * SIZE, R() * SIZE, 4 + R() * 18, 0, 7);
    g.fill();
  }
}

function concrete(g: Ctx, R: Rand): void {
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = grey(200 + Math.floor(R() * 50), 0.6);
    g.fillRect(R() * SIZE, R() * SIZE, 2, 2);
  }
}

function uvGrid(g: Ctx): void {
  checker(g, "#c8c8c8", "#efefef");
  g.fillStyle = "#555";
  g.font = "11px sans-serif";
  for (let r = 0; r < 8; r++) {
    for (let k = 0; k < 8; k++) g.fillText(String.fromCharCode(65 + k) + (8 - r), k * 32 + 8, r * 32 + 20);
  }
}

const DRAW: Record<string, (g: Ctx, R: Rand) => void> = {
  plank: planks,
  brick: bricks,
  tile: tiles,
  check: (g) => checker(g, "#9a9a9a", "#f4f4f4"),
  stone,
  concrete,
  uvgrid: uvGrid,
};

function canvasFor(kind: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f2f2f2";
  g.fillRect(0, 0, SIZE, SIZE);
  DRAW[kind]?.(g, seededRandom(7));
  return c;
}

const canvases = new Map<string, HTMLCanvasElement>();
const textures = new Map<string, THREE.Texture>();

/** the texture a material asks for (tiling, rotation and offset applied), shared between materials */
export function textureFor(m: Material): THREE.Texture | null {
  if (!m.pattern || m.pattern === "none") return null;
  const key = [m.pattern, m.repU, m.repV, m.rot, m.offU, m.offV].join("|");
  const cached = textures.get(key);
  if (cached) return cached;
  let canvas = canvases.get(m.pattern);
  if (!canvas) {
    canvas = canvasFor(m.pattern);
    canvases.set(m.pattern, canvas);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(m.repU, m.repV);
  t.offset.set(m.offU, m.offV);
  t.center.set(0.5, 0.5);
  t.rotation = (m.rot * Math.PI) / 180;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  textures.set(key, t);
  return t;
}
