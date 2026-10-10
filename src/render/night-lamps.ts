/** At night, glowing objects (lanterns, crystals, anything with Glow) light up their surroundings. */
import * as THREE from "three";
import type { Obj } from "@/world/model";

/** a fixed number of point lights: changing how many lights there are would recompile every material */
const LAMP_COUNT = 6;
const LAMP_RANGE_M = 10;
const LAMP_DECAY = 1.6;
const MIN_GLOW = 0.5;
const MAX_GLOW = 2;
const LAMP_GAIN = 6;

interface Glow {
  id: string;
  color: THREE.Color;
  strength: number;
}

function strongestGlow(o: Obj): Glow | null {
  let best = 0;
  let color = "#ffffff";
  for (const m of o.materials) {
    if (m.emissive > best) {
      best = m.emissive;
      color = m.color;
    }
  }
  if (best < MIN_GLOW) return null;
  return { id: o.id, color: new THREE.Color(color), strength: Math.min(MAX_GLOW, best) };
}

export class NightLamps {
  private readonly lamps: THREE.PointLight[] = [];
  private glowing: Glow[] = [];

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < LAMP_COUNT; i++) {
      const lamp = new THREE.PointLight(0xffd27a, 0, LAMP_RANGE_M, LAMP_DECAY);
      scene.add(lamp);
      this.lamps.push(lamp);
    }
  }

  /** find the glowing objects again (after the world changed) */
  scan(objects: Obj[]): void {
    this.glowing = [];
    for (const o of objects) {
      if (o.hidden) continue;
      const glow = strongestGlow(o);
      if (glow) this.glowing.push(glow);
    }
  }

  /** the nearest glowing objects get a lamp, scaled by how dark it is (0..1) */
  update(objects: Obj[], from: THREE.Vector3, dark: number): void {
    const near = this.glowing
      .map((g) => {
        const o = objects.find((x) => x.id === g.id);
        if (!o) return null;
        const p = new THREE.Vector3().fromArray(o.pos);
        return { g, p, d: from.distanceToSquared(p) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.d - b.d)
      .slice(0, LAMP_COUNT);
    this.lamps.forEach((lamp, i) => {
      const n = near[i];
      if (!n || dark < 0.02) {
        lamp.intensity = 0;
        return;
      }
      lamp.position.copy(n.p);
      lamp.color.copy(n.g.color);
      lamp.intensity = dark * n.g.strength * LAMP_GAIN;
    });
  }
}
