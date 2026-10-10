/** A dome of stars that follows the camera and fades in with the dark. */
import * as THREE from "three";

const STAR_COUNT = 900;
const DOME_RADIUS_M = 1500;

/** a fixed seed, so the sky looks the same every night */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0;
    return s / 4294967296;
  };
}

function starPositions(): Float32Array {
  const p = new Float32Array(STAR_COUNT * 3);
  const r = seededRandom(7);
  for (let i = 0; i < STAR_COUNT; i++) {
    const z = r() * 0.95 + 0.05; // above the horizon
    const a = r() * Math.PI * 2;
    const q = Math.sqrt(1 - z * z);
    p.set([Math.cos(a) * q * DOME_RADIUS_M, Math.sin(a) * q * DOME_RADIUS_M, z * DOME_RADIUS_M], i * 3);
  }
  return p;
}

export class Stars {
  private readonly points: THREE.Points;
  private readonly material: THREE.PointsMaterial;

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(starPositions(), 3));
    this.material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = -1;
    scene.add(this.points);
  }

  /** `dark` 0..1: how far into the night we are */
  update(dark: number, cameraPosition: THREE.Vector3): void {
    this.material.opacity = dark * 0.9;
    this.points.visible = dark > 0.01;
    this.points.position.copy(cameraPosition);
  }
}
