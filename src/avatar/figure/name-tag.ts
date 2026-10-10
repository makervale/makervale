/** The name floating over an avatar's head. */
import * as THREE from "three";

const WIDTH_PX = 512;
const HEIGHT_PX = 96;
const MAX_TEXT_PX = 480;

function drawTag(text: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = WIDTH_PX;
  c.height = HEIGHT_PX;
  const g = c.getContext("2d")!;
  g.font = '600 44px "Noto Sans", sans-serif';
  const w = Math.min(500, g.measureText(text).width + 48);
  g.fillStyle = "rgba(0,0,0,.45)";
  g.beginPath();
  // roundRect is missing in some older browsers
  if (g.roundRect) g.roundRect((WIDTH_PX - w) / 2, 14, w, 68, 14);
  else g.rect((WIDTH_PX - w) / 2, 14, w, 68);
  g.fill();
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, WIDTH_PX / 2, 49, MAX_TEXT_PX);
  return c;
}

export function nameTag(text: string): THREE.Sprite {
  const t = new THREE.CanvasTexture(drawTag(text));
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.3, 0.24, 1);
  return s;
}

export function disposeTag(s: THREE.Sprite): void {
  s.material.map?.dispose();
  s.material.dispose();
}
