/** Draw a mesh into a 2D canvas with one shared offscreen renderer, turning slowly with `angle`. */
import * as THREE from "three";
import type { Mesh } from "@/lib/mesh/mesh";
import type { ElementSelection } from "@/lib/mesh/selection";
import { addMesh, clearGroup } from "./demo-scene";

const FOV_DEG = 32;
const VIEW_DIRECTION = new THREE.Vector3(1.5, -2.3, 1.35).normalize();
const Z = new THREE.Vector3(0, 0, 1);
/** how much of the frame the shape fills: landscape canvases leave room on the sides */
const FILL_WIDE = 0.82;
const FILL_SQUARE = 1.02;
const MIN_RADIUS = 0.05;

let renderer: THREE.WebGLRenderer | null = null;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.01, 100);
const root = new THREE.Group();
scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(2, -3, 4);
scene.add(sun, root);

function rendererOfSize(w: number, h: number): THREE.WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
  }
  const c = renderer.domElement;
  if (c.width !== w || c.height !== h) renderer.setSize(w, h, false);
  return renderer;
}

function aim(sphere: THREE.Sphere, w: number, h: number, angle: number): void {
  const dir = VIEW_DIRECTION.clone().applyAxisAngle(Z, angle);
  const halfFov = (camera.fov * Math.PI) / 180 / 2;
  const dist = (Math.max(MIN_RADIUS, sphere.radius) / Math.sin(halfFov)) * (w > h ? FILL_WIDE : FILL_SQUARE);
  camera.aspect = w / h;
  camera.position.copy(sphere.center).addScaledVector(dir, dist);
  camera.up.set(0, 0, 1);
  camera.lookAt(sphere.center);
  camera.near = dist / 50;
  camera.far = dist * 4;
  camera.updateProjectionMatrix();
}

/** `fit` keeps "before" and "after" at the same scale */
export function draw(target: HTMLCanvasElement, m: Mesh, s: ElementSelection, angle = 0, fit?: THREE.Sphere): void {
  const { width: w, height: h } = target;
  const r = rendererOfSize(w, h);
  clearGroup(root);
  addMesh(root, m, s);
  aim(fit ?? boundsOf([m]).getBoundingSphere(new THREE.Sphere()), w, h, angle);
  r.setClearColor(0x000000, 0);
  r.clear();
  r.render(scene, camera);
  const ctx = target.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(r.domElement, 0, 0);
}

function boundsOf(meshes: Mesh[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const m of meshes) for (const v of m.v) box.expandByPoint(new THREE.Vector3(...v));
  return box;
}

/** one sphere around both meshes, so the pictures share a scale */
export function fitBoth(a: Mesh | null, b: Mesh | null): THREE.Sphere | undefined {
  const box = boundsOf([a, b].filter((m): m is Mesh => !!m));
  return box.isEmpty() ? undefined : box.getBoundingSphere(new THREE.Sphere());
}
