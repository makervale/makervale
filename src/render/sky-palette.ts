/** Light and sky colours by sun elevation, interpolated between hand-picked keyframes. */
import * as THREE from "three";

export interface SkyLight {
  top: THREE.Color;
  bottom: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  ambientSky: THREE.Color;
  ambientGround: THREE.Color;
  ambientIntensity: number;
}

// elevation (degrees), sky top, sky bottom, sun colour, sun strength, ambient sky, ambient ground, ambient strength
type Key = [number, string, string, string, number, string, string, number];
const KEYS: Key[] = [
  [-90, "#04060d", "#0b1222", "#8fa6d9", 0.22, "#28324a", "#14161a", 0.32],
  [-12, "#0a1022", "#1a2442", "#9fb2e0", 0.22, "#34405e", "#191b20", 0.36],
  [-3, "#2a2f55", "#c96f4a", "#ff9a5a", 0.3, "#6b6a8a", "#3a3029", 0.55],
  [4, "#5d7fb3", "#f2a66b", "#ffb070", 1.0, "#b7b9c9", "#6e6050", 0.85],
  [14, "#7ea6d4", "#e9d6bf", "#ffe0b8", 1.6, "#d6e1ec", "#857c68", 1.05],
  [35, "#8db2d9", "#dfe7ee", "#ffffff", 1.9, "#dfe9f3", "#8a8370", 1.2],
  [90, "#7aa9dc", "#d8e6f2", "#ffffff", 2.0, "#e4eef7", "#8a8370", 1.25],
];

const mix = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), k);

export function skyLightAt(elevationDegrees: number): SkyLight {
  let i = 0;
  while (i < KEYS.length - 2 && elevationDegrees > KEYS[i + 1][0]) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const k = Math.min(1, Math.max(0, (elevationDegrees - a[0]) / (b[0] - a[0])));
  return {
    top: mix(a[1], b[1], k),
    bottom: mix(a[2], b[2], k),
    sun: mix(a[3], b[3], k),
    sunIntensity: a[4] + (b[4] - a[4]) * k,
    ambientSky: mix(a[5], b[5], k),
    ambientGround: mix(a[6], b[6], k),
    ambientIntensity: a[7] + (b[7] - a[7]) * k,
  };
}
