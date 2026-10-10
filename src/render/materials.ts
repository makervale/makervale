/** three.js materials for the world's materials, shared between every object that uses the same one. */
import * as THREE from "three";
import type { Material } from "@/world/model";
import { textureFor } from "./textures";

const EMISSIVE_GAIN = 1.5;

function makeMaterial(m: Material, doubleSided: boolean): THREE.MeshStandardMaterial {
  const map = textureFor(m);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(m.color),
    roughness: m.roughness,
    metalness: m.metalness,
    map,
    transparent: m.opacity < 1,
    opacity: m.opacity,
    side: m.opacity < 1 || doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (m.emissive > 0) {
    material.emissive = new THREE.Color(m.color);
    material.emissiveIntensity = m.emissive * EMISSIVE_GAIN;
    if (map) material.emissiveMap = map;
  }
  return material;
}

export class MaterialCache {
  private readonly cache = new Map<string, THREE.MeshStandardMaterial>();

  /** `doubleSided` for open surfaces, so their inside is drawn too */
  get(m: Material, doubleSided: boolean): THREE.MeshStandardMaterial {
    const key = JSON.stringify(m) + (doubleSided ? "|ds" : "");
    let material = this.cache.get(key);
    if (!material) {
      material = makeMaterial(m, doubleSided);
      this.cache.set(key, material);
    }
    return material;
  }
}
