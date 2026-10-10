/**
 * The built-in figure, built in world axes (Z up, facing +Y) but in a T-pose, so every joint at rest matches the
 * animator's rest pose with no rotation; arms are modelled hanging and turned outwards.
 */
import * as THREE from "three";
import type { Look } from "../look";
import { addHair } from "./hair";
import { ball, limb, material, part, turned } from "./parts";

/** standing hips height of a figure of height 1, metres */
export const FIGURE_HIPS_M = 0.92;
/** overall height of a figure of height 1, metres */
export const FIGURE_HEIGHT_M = 1.78;

export interface Body {
  root: THREE.Group;
  /** the joints by name: hips, spine, neck, head, armL/R, elbowL/R, handL/R, legL/R, kneeL/R, footL/R */
  joints: Record<string, THREE.Object3D>;
  eyes: THREE.Object3D[];
}

interface Materials {
  skin: THREE.MeshStandardMaterial;
  shirt: THREE.MeshStandardMaterial;
  pants: THREE.MeshStandardMaterial;
  shoes: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
}

interface Builder {
  joints: Record<string, THREE.Object3D>;
  m: Materials;
  /** widens the trunk with the build */
  wide: number;
  /** thickens the limbs with the build */
  limbK: number;
  pivot(name: string, parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group;
}

function makeBuilder(look: Look): Builder {
  const joints: Record<string, THREE.Object3D> = {};
  const m: Materials = {
    skin: material(look.skin, 0.55),
    shirt: material(look.shirt, 0.8),
    pants: material(look.pants, 0.85),
    shoes: material(look.shoes, 0.45),
    hair: material(look.hairColor, 0.75),
  };
  const pivot = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    joints[name] = g;
    return g;
  };
  return { joints, m, wide: 0.92 + look.build * 0.22, limbK: 0.9 + look.build * 0.22, pivot };
}

function trunk(b: Builder, body: THREE.Group): THREE.Group {
  const hips = b.pivot("hips", body, 0, 0, FIGURE_HIPS_M);
  const pelvisProfile: [number, number][] = [
    [0, -0.07],
    [0.12, -0.06],
    [0.15, 0.0],
    [0.145, 0.07],
    [0.13, 0.1],
    [0, 0.1],
  ];
  const pelvis = turned(pelvisProfile, b.m.pants);
  pelvis.scale.set(b.wide, 0.72, 1);
  hips.add(pelvis);
  const spine = b.pivot("spine", hips, 0, 0, 0.07);
  const torsoProfile: [number, number][] = [
    [0, 0],
    [0.13, 0],
    [0.128, 0.08],
    [0.135, 0.18],
    [0.155, 0.3],
    [0.165, 0.38],
    [0.158, 0.44],
    [0.12, 0.5],
    [0.06, 0.53],
    [0, 0.53],
  ];
  const torso = turned(torsoProfile, b.m.shirt);
  torso.scale.set(b.wide * 1.05, 0.68, 1);
  spine.add(torso);
  const belt = turned(
    [
      [0.133, -0.015],
      [0.137, 0.015],
    ],
    material("#2a2522", 0.5),
  );
  belt.scale.set(b.wide, 0.7, 1);
  spine.add(belt);
  return spine;
}

function eye(s: number, white: THREE.Material, iris: THREE.Material): THREE.Group {
  const e = new THREE.Group();
  e.position.set(s * 0.036, 0.083, 0.118);
  e.add(ball(0.017, white, 1, 0.8, 0.9));
  const ir = ball(0.0095, iris);
  ir.position.y = 0.011;
  e.add(ir);
  return e;
}

function face(b: Builder, head: THREE.Object3D): THREE.Object3D[] {
  const white = material("#f4f1ea", 0.3);
  const iris = material("#2b2622", 0.2);
  const eyes: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    head.add(
      ball(0.022, b.m.skin, 0.45, 0.9, 1.25)
        .translateX(s * 0.093)
        .translateZ(0.1),
    ); // ear
    const e = eye(s, white, iris);
    head.add(e);
    eyes.push(e);
    const brow = part(new THREE.BoxGeometry(0.034, 0.008, 0.007), b.m.hair);
    brow.position.set(s * 0.037, 0.092, 0.145);
    brow.rotation.y = s * -0.12;
    head.add(brow);
  }
  const nose = part(new THREE.ConeGeometry(0.014, 0.036, 10), b.m.skin);
  nose.rotation.x = Math.PI / 2 + 0.25;
  nose.position.set(0, 0.104, 0.092);
  head.add(nose);
  const mouth = part(new THREE.BoxGeometry(0.034, 0.006, 0.008), material("#a8574c", 0.6));
  mouth.position.set(0, 0.088, 0.058);
  head.add(mouth);
  return eyes;
}

function neckAndHead(b: Builder, spine: THREE.Object3D, look: Look): THREE.Object3D[] {
  const neck = b.pivot("neck", spine, 0, 0, 0.5);
  neck.add(limb(0.048, 0.044, 0.1, b.m.skin).translateZ(0.1));
  const head = b.pivot("head", neck, 0, 0.005, 0.09);
  head.add(ball(0.104, b.m.skin, 0.9, 1, 1.12).translateZ(0.1));
  head.add(ball(0.072, b.m.skin, 1, 0.95, 0.85).translateY(0.03).translateZ(0.045)); // jaw
  const eyes = face(b, head);
  addHair(head, look.hair, b.m.hair);
  return eyes;
}

function arm(b: Builder, spine: THREE.Object3D, side: string, s: number): void {
  // arm segments point outwards at rest (T-pose): geometry made hanging, then turned about Y
  const out = (g: THREE.Object3D) => {
    const w = new THREE.Group();
    w.rotation.y = (-s * Math.PI) / 2;
    w.add(g);
    return w;
  };
  const { skin, shirt } = b.m;
  const k = b.limbK;
  const shoulder = b.pivot("arm" + side, spine, s * 0.172 * b.wide, 0, 0.44);
  shoulder.add(out(ball(0.054 * k, shirt, 1.1, 1, 1)), out(limb(0.055 * k, 0.045 * k, 0.27, shirt)));
  const elbow = b.pivot("elbow" + side, shoulder, s * 0.28, 0, 0);
  elbow.add(out(ball(0.04 * k, skin)), out(limb(0.04 * k, 0.031 * k, 0.24, skin)));
  const wrist = b.pivot("hand" + side, elbow, s * 0.25, 0, 0);
  const hand = new THREE.Group();
  hand.add(ball(0.044, skin, 0.55, 0.95, 1.3).translateZ(-0.045));
  const thumb = ball(0.016, skin, 1, 1, 2.2);
  thumb.position.set(-s * 0.015, 0.03, -0.03);
  thumb.rotation.x = 0.5;
  hand.add(thumb);
  wrist.add(out(hand));
}

function leg(b: Builder, hips: THREE.Object3D, side: string, s: number): void {
  const { pants, shoes } = b.m;
  const k = b.limbK;
  const hip = b.pivot("leg" + side, hips, s * 0.088 * b.wide, 0, -0.02);
  hip.add(limb(0.085 * k, 0.06 * k, 0.44, pants));
  const knee = b.pivot("knee" + side, hip, 0, 0, -0.44);
  knee.add(ball(0.058 * k, pants), limb(0.058 * k, 0.045 * k, 0.41, pants));
  const foot = b.pivot("foot" + side, knee, 0, 0, -0.41);
  foot.add(ball(0.06, shoes, 0.85, 2.1, 0.7).translateY(0.045).translateZ(-0.03));
  const sole = part(new THREE.BoxGeometry(0.1, 0.25, 0.018), material("#151515", 0.8));
  sole.position.set(0, 0.045, -0.065);
  foot.add(sole);
}

export function buildBody(look: Look): Body {
  const b = makeBuilder(look);
  const root = new THREE.Group();
  root.name = "Figure";
  const spine = trunk(b, root);
  const eyes = neckAndHead(b, spine, look);
  for (const [side, s] of [
    ["L", -1],
    ["R", 1],
  ] as [string, number][]) {
    arm(b, spine, side, s);
    leg(b, b.joints.hips, side, s);
  }
  return { root, joints: b.joints, eyes };
}
