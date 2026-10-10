/** Building blocks of the built-in figure, all in world axes (Z up). */
import * as THREE from "three";

export const material = (color: string, roughness = 0.7, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export function part(g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
  const x = new THREE.Mesh(g, m);
  x.castShadow = true;
  return x;
}

/** a tapered limb hanging down from its joint */
export function limb(r0: number, r1: number, len: number, m: THREE.Material): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r1, r0, len, 14, 1);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -len / 2);
  return part(g, m);
}

export function ball(r: number, m: THREE.Material, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const x = part(new THREE.SphereGeometry(r, 20, 14), m);
  x.scale.set(sx, sy, sz);
  return x;
}

/** a body of revolution around Z from (radius, height) points */
export function turned(pts: [number, number][], m: THREE.Material, segments = 24): THREE.Mesh {
  const g = new THREE.LatheGeometry(
    pts.map(([r, z]) => new THREE.Vector2(r, z)),
    segments,
  );
  g.rotateX(Math.PI / 2);
  return part(g, m);
}

export function disposeTree(o: THREE.Object3D): void {
  o.traverse((n) => {
    if (!(n instanceof THREE.Mesh || n instanceof THREE.Sprite)) return;
    n.geometry?.dispose();
    const materials = Array.isArray(n.material) ? n.material : [n.material];
    for (const m of materials) {
      (m as THREE.MeshStandardMaterial).map?.dispose();
      m.dispose();
    }
  });
}
