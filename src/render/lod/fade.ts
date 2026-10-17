/**
 * Changing form without a pop, the way games have done it since UE4 and Unity: for a moment both forms are drawn,
 * each on its own complementary share of the pixels (a fine noise pattern), and the new one takes over pixel by
 * pixel as the old one gives way. The fading copies are this module's own meshes, with their own copies of the
 * materials (the same shader program, only the share differs), so the object's real mesh is never touched.
 */
import * as THREE from "three";

export const FADE_S = 0.3;

/** one form while it fades: what to draw and with which materials */
export interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

/** share > 0: draw the pixels whose noise is below it; share < 0: draw the others */
const DITHER = /* glsl */ `
  float lodNoise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (lodShare > 0.0 ? lodNoise >= lodShare : lodNoise < -lodShare) discard;
`;

function dithered<M extends THREE.Material>(m: M, share: { value: number }): M {
  const c = m.clone() as M;
  c.onBeforeCompile = (shader) => {
    shader.uniforms.lodShare = share;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float lodShare;")
      .replace("void main() {", "void main() {\n" + DITHER);
  };
  return c;
}

const DEPTH = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });

interface Running {
  t0: number;
  meshes: THREE.Mesh[];
  clones: THREE.Material[];
  incoming: { value: number };
  outgoing: { value: number };
}

export class Crossfade {
  private running = new Map<string, Running>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly now: () => number = () => performance.now() / 1000,
  ) {}

  has(id: string): boolean {
    return this.running.has(id);
  }

  /** fade from one form to the other (null: nothing, as beyond the fog) */
  start(id: string, from: Part | null, to: Part | null, at: THREE.Matrix4): void {
    this.stop(id);
    const r: Running = { t0: this.now(), meshes: [], clones: [], incoming: { value: 0 }, outgoing: { value: 0 } };
    this.running.set(id, r);
    for (const [part, share] of [
      [from, r.outgoing],
      [to, r.incoming],
    ] as const) {
      if (!part) continue;
      const mats = (Array.isArray(part.material) ? part.material : [part.material]).map((m) => dithered(m, share));
      r.clones.push(...mats);
      const mesh = new THREE.Mesh(part.geometry, Array.isArray(part.material) ? mats : mats[0]);
      mesh.castShadow = mesh.receiveShadow = true;
      // the shadow fades the same way, pixel by pixel of the shadow map
      mesh.customDepthMaterial = dithered(DEPTH, share);
      r.clones.push(mesh.customDepthMaterial);
      mesh.matrixAutoUpdate = false;
      mesh.raycast = () => {};
      this.scene.add(mesh);
      r.meshes.push(mesh);
    }
    this.advance(r, 0, at);
  }

  /** per frame: move each fade on and place it where its object is now; finished ones end */
  tick(placeOf: (id: string) => THREE.Matrix4 | null): void {
    const now = this.now();
    for (const [id, r] of this.running) {
      const t = (now - r.t0) / FADE_S;
      const at = placeOf(id);
      if (t >= 1 || !at) {
        this.stop(id);
        continue;
      }
      this.advance(r, t, at);
    }
  }

  private advance(r: Running, t: number, at: THREE.Matrix4): void {
    r.incoming.value = Math.max(t, 1e-3);
    r.outgoing.value = -Math.max(t, 1e-3);
    for (const m of r.meshes) {
      m.matrix.copy(at);
      m.matrixWorld.copy(at);
    }
  }

  stop(id: string): void {
    const r = this.running.get(id);
    if (!r) return;
    for (const m of r.meshes) this.scene.remove(m);
    for (const c of r.clones) c.dispose();
    this.running.delete(id);
  }
}
