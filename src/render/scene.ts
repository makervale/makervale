/** The scene graph: camera, lights, the ground, and a second scene for gizmos drawn on top. */
import * as THREE from "three";
import { cssVar } from "./theme";

export interface SceneParts {
  scene: THREE.Scene;
  /** drawn after the world with the depth cleared, so handles always show */
  gizmoScene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  /** where the sun (or moon) is, relative to what the camera looks at; the sky moves it */
  sunOffset: THREE.Vector3;
  ground: THREE.Mesh;
}

const GROUND_SIZE_M = 512;
const GRID_TILES = 64;
const SHADOW_EXTENT_M = 22;

function makeSun(): THREE.DirectionalLight {
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -SHADOW_EXTENT_M,
    right: SHADOW_EXTENT_M,
    top: SHADOW_EXTENT_M,
    bottom: -SHADOW_EXTENT_M,
    near: 1,
    far: 120,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  return sun;
}

/** a metre grid in the page's colours, repeated over the ground */
function gridTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const g = cv.getContext("2d")!;
  g.fillStyle = cssVar("--ground");
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = cssVar("--grid");
  g.lineWidth = 1.5;
  for (let i = 0; i <= 8; i++) {
    g.beginPath();
    g.moveTo(i * 32, 0);
    g.lineTo(i * 32, 256);
    g.moveTo(0, i * 32);
    g.lineTo(256, i * 32);
    g.stroke();
  }
  g.strokeStyle = cssVar("--grid-major");
  g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(GRID_TILES, GRID_TILES);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeGround(): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: gridTexture() });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE_M, GROUND_SIZE_M), material);
  ground.receiveShadow = true;
  ground.userData.ground = true;
  return ground;
}

export function createScene(): SceneParts {
  // the world is Z up; set before any camera.lookAt
  THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
  const scene = new THREE.Scene();
  const gizmoScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 4000);
  const hemi = new THREE.HemisphereLight(0xdfe9f3, 0x8a8370, 1.2);
  const sun = makeSun();
  const ground = makeGround();
  scene.add(hemi, sun, sun.target, ground);
  return { scene, gizmoScene, camera, hemi, sun, sunOffset: new THREE.Vector3(14, -10, 22), ground };
}
