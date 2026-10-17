/**
 * View › Sand map: the laws of space made visible as glassy shells round the crowded places, like a weather radar
 * in 3D. Each shell is where the sand crosses a level (blue at 40% of the limit, amber at 70%, red over it), so
 * you see exactly where a tight zone begins, also round the floors of a tower. The shells are clear in the middle
 * and glow at their edges, to leave what's inside them readable. Nothing here decides anything: it shows the
 * same ledger every change is checked against (app/space.ts).
 */
import * as THREE from "three";
import type { Field, Ledger } from "@/lib/weight";
import { fieldsOf, isoSurface } from "@/lib/weight";

const LEVELS: [number, number][] = [
  [0.4, 0x4aa8ff],
  [0.7, 0xffb238],
  [1, 0xff3b30],
];
/** places fuller than this are where shells may be: the lowest level, with room for it to close round them */
const FROM = 0.3;
const SETTLE_MS = 150;

const VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalMatrix * normal;
  vView = -p.xyz;
  gl_Position = projectionMatrix * p;
}
`;

/** clear where you look straight through, glowing where you look along the shell (Fresnel) */
const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float facing = abs(dot(normalize(vNormal), normalize(vView)));
  float rim = pow(1.0 - facing, 2.2);
  gl_FragColor = vec4(uColor * (0.85 + 0.5 * rim), 0.07 + 0.6 * rim);
}
`;

function shell(f: Field, level: number, color: number): THREE.Mesh | null {
  const s = isoSurface(f, level);
  if (!s.indices.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(s.positions, 3));
  g.setIndex(s.indices);
  g.computeVertexNormals();
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, material);
  mesh.raycast = () => {};
  mesh.renderOrder = 10 + level;
  return mesh;
}

export class SandMap {
  on = false;
  private shells: THREE.Mesh[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly ledger: Ledger,
    private readonly changed: (on: boolean) => void = () => {},
  ) {}

  toggle(): boolean {
    this.on = !this.on;
    this.draw();
    this.changed(this.on);
    return this.on;
  }

  /** the scene changed: redraw once it settles */
  sync(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.draw();
    }, SETTLE_MS);
  }

  private draw(): void {
    this.clear();
    if (!this.on) return;
    for (const f of fieldsOf(this.ledger, FROM)) {
      for (const [level, color] of LEVELS) {
        const m = shell(f, level, color);
        if (!m) continue;
        this.scene.add(m);
        this.shells.push(m);
      }
    }
  }

  private clear(): void {
    for (const m of this.shells) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.shells = [];
  }
}
