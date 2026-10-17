import * as THREE from "three";
import { wrapText } from "./wrap-text";

const CANVAS_W = 640;
const PAD = 22;
const LINE_H = 40;
const TAIL = 16;
const RADIUS = 18;
const FONT = '500 30px "Noto Sans", sans-serif';
/** the widest bubble, in the world */
const WORLD_WIDTH_M = 1.85;

const STYLE = {
  person: { fill: "rgba(255,255,255,.94)", stroke: "rgba(0,0,0,.25)", text: "#1d2126" },
  object: { fill: "rgba(52,44,20,.9)", stroke: "rgba(242,212,138,.9)", text: "#f8e7b8" },
};

export type BubbleKind = keyof typeof STYLE;

function outline(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, bodyH: number): void {
  const mid = CANVAS_W / 2;
  g.beginPath();
  g.moveTo(x0 + RADIUS, y0);
  g.arcTo(x0 + w, y0, x0 + w, y0 + bodyH, RADIUS);
  g.arcTo(x0 + w, y0 + bodyH, x0, y0 + bodyH, RADIUS);
  g.lineTo(mid + 14, y0 + bodyH);
  g.lineTo(mid, y0 + bodyH + TAIL);
  g.lineTo(mid - 14, y0 + bodyH);
  g.arcTo(x0, y0 + bodyH, x0, y0, RADIUS);
  g.arcTo(x0, y0, x0 + w, y0, RADIUS);
  g.closePath();
}

/** a speech bubble as a sprite whose bottom (the tail's tip) sits at its position */
export function drawBubble(text: string, kind: BubbleKind): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d")!;
  g.font = FONT;
  const lines = wrapText(text, CANVAS_W - PAD * 2, (s) => g.measureText(s).width);
  const w = Math.min(CANVAS_W, Math.max(...lines.map((l) => g.measureText(l).width)) + PAD * 2);
  const h = lines.length * LINE_H + PAD * 1.4 + 18;
  canvas.width = CANVAS_W;
  // as tall as the text needs (up to MAX_LINES): a long welcome must not lose its first lines off the top
  canvas.height = Math.ceil(h);
  const style = STYLE[kind];
  const x0 = (CANVAS_W - w) / 2;
  const y0 = canvas.height - h;
  g.font = FONT;
  g.fillStyle = style.fill;
  g.strokeStyle = style.stroke;
  g.lineWidth = 3;
  outline(g, x0, y0, w, h - 18);
  g.fill();
  g.stroke();
  g.fillStyle = style.text;
  g.textAlign = "center";
  g.textBaseline = "middle";
  lines.forEach((l, i) => g.fillText(l, CANVAS_W / 2, y0 + PAD * 0.7 + LINE_H * (i + 0.5)));
  return toSprite(canvas);
}

const LABEL = { fill: "rgba(22,26,34,.82)", stroke: "rgba(255,255,255,.35)", text: "#ffffff" };
const LABEL_W_M = 2.4;

/** a script's label: a plain sign, its lines as written (and wrapped when long), sitting on its position */
export function drawLabel(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d")!;
  g.font = FONT;
  const lines = text.split("\n").flatMap((l) => wrapText(l, CANVAS_W - PAD * 2, (s) => g.measureText(s).width));
  const w = Math.min(CANVAS_W, Math.max(...lines.map((l) => g.measureText(l).width)) + PAD * 2);
  canvas.width = CANVAS_W;
  canvas.height = Math.ceil(lines.length * LINE_H + PAD * 1.4);
  const x0 = (CANVAS_W - w) / 2;
  g.font = FONT;
  g.fillStyle = LABEL.fill;
  g.strokeStyle = LABEL.stroke;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(x0, 0, w, canvas.height, RADIUS);
  g.fill();
  g.stroke();
  g.fillStyle = LABEL.text;
  g.textAlign = "center";
  g.textBaseline = "middle";
  lines.forEach((l, i) => g.fillText(l, CANVAS_W / 2, PAD * 0.7 + LINE_H * (i + 0.5)));
  const sprite = toSprite(canvas, LABEL_W_M);
  // a sign, not a word said: things in front of it hide it
  sprite.material.depthTest = true;
  return sprite;
}

function toSprite(canvas: HTMLCanvasElement, widthM = WORLD_WIDTH_M): THREE.Sprite {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
  const sprite = new THREE.Sprite(material);
  const k = widthM / CANVAS_W;
  sprite.scale.set(CANVAS_W * k, canvas.height * k, 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 10;
  return sprite;
}
