/** A VRM file (three-vrm, MIT) → an avatar body the animator can drive. */
import * as THREE from "three";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import type * as VrmModule from "@pixiv/three-vrm";
import type { GLTFLoaderPlugin, GLTFParser } from "three/addons/loaders/GLTFLoader.js";
import type { Rig } from "../animator";
import type { Bone } from "../bones";

export interface VRMBody {
  scene: THREE.Object3D;
  vrm: VRM;
  rig: Rig;
  /** standing hips height, metres */
  hipsHeight: number;
  height: number;
  title: string;
  /** per frame: spring bones, expressions; `blink` 0 open … 1 closed */
  update(dt: number, blink: number): void;
  dispose(): void;
}

type VrmLib = typeof VrmModule;
let lib: Promise<VrmLib> | null = null;

/** loaded on first use: most visitors never wear a model */
const loadLib = (): Promise<VrmLib> => (lib ??= import("@pixiv/three-vrm"));

async function parseGltf(V: VrmLib, buf: ArrayBuffer): Promise<VRM> {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  loader.register((p: GLTFParser) => new V.VRMLoaderPlugin(p) as unknown as GLTFLoaderPlugin);
  // parsing detaches the buffer; keep the caller's copy usable
  const gltf = await loader.parseAsync(buf.slice(0), "");
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm?.humanoid?.getNormalizedBoneNode("hips")) throw new Error("This is not a VRM humanoid avatar");
  V.VRMUtils.removeUnnecessaryVertices(gltf.scene);
  V.VRMUtils.combineSkeletons(gltf.scene);
  V.VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    // skinned meshes move away from their bind-pose bounds; culling them would make limbs vanish
    o.frustumCulled = false;
  });
  return vrm;
}

function makeRig(vrm: VRM, hipsHeight: number): Rig {
  const nodes = new Map<Bone, THREE.Object3D | null>();
  const node = (b: Bone) => {
    if (!nodes.has(b)) nodes.set(b, vrm.humanoid.getNormalizedBoneNode(b as VRMHumanBoneName));
    return nodes.get(b)!;
  };
  const hips = node("hips")!;
  const rest = hips.position.clone();
  // VRM 0.x models face -Z; rotateVRM0 turned the whole scene half a turn about Y, so their normalized bones
  // are mirrored in X and Z relative to the clips (VRM 1.0 convention): flip those components
  const sx = vrm.meta?.metaVersion === "0" ? -1 : 1;
  return {
    has: (b) => !!node(b),
    set: (b, q) => {
      node(b)!.quaternion.set(q.x * sx, q.y, q.z * sx, q.w);
    },
    hips: (p) => {
      hips.position.set(rest.x + p.x * hipsHeight * sx, p.y * hipsHeight, rest.z + p.z * hipsHeight * sx);
    },
  };
}

function measure(vrm: VRM): { hipsHeight: number; height: number } {
  vrm.scene.updateMatrixWorld(true);
  const hipsHeight = vrm.humanoid.getNormalizedBoneNode("hips")!.getWorldPosition(new THREE.Vector3()).y;
  const head = vrm.humanoid.getNormalizedBoneNode("head");
  const headY = head ? head.getWorldPosition(new THREE.Vector3()).y : hipsHeight * 1.75;
  // hats and hair can reach far above the head: the name tag goes a little over the head, not over the hat
  const box = new THREE.Box3().setFromObject(vrm.scene);
  return { hipsHeight, height: Math.max(headY + 0.12, Math.min(box.max.y, headY + 0.45)) };
}

function titleOf(vrm: VRM): string {
  const meta = vrm.meta;
  if (!meta) return "Avatar";
  return ("name" in meta ? meta.name : meta.title) || "Avatar";
}

export async function parseVRM(buf: ArrayBuffer): Promise<VRMBody> {
  const V = await loadLib();
  const vrm = await parseGltf(V, buf);
  const { hipsHeight, height } = measure(vrm);
  const expressions = vrm.expressionManager;
  return {
    scene: vrm.scene,
    vrm,
    rig: makeRig(vrm, hipsHeight),
    hipsHeight,
    height,
    title: titleOf(vrm),
    update(dt, blink) {
      expressions?.setValue("blink", blink);
      vrm.update(dt);
    },
    dispose() {
      V.VRMUtils.deepDispose(vrm.scene);
      vrm.scene.removeFromParent();
    },
  };
}
