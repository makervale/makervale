/** The built-in figure's joints, seen by the animator. */
import type * as THREE from "three";
import type { Rig } from "../animator";
import type { Bone } from "../bones";
import { RIG_FROM_WORLD, WORLD_FROM_RIG } from "../rig-space";
import { FIGURE_HIPS_M } from "./build-body";

const JOINT_OF: Partial<Record<Bone, string>> = {
  hips: "hips",
  spine: "spine",
  neck: "neck",
  head: "head",
  leftUpperArm: "armL",
  leftLowerArm: "elbowL",
  leftHand: "handL",
  rightUpperArm: "armR",
  rightLowerArm: "elbowR",
  rightHand: "handR",
  leftUpperLeg: "legL",
  leftLowerLeg: "kneeL",
  leftFoot: "footL",
  rightUpperLeg: "legR",
  rightLowerLeg: "kneeR",
  rightFoot: "footR",
};

/** the figure's joints sit in world axes, so a rig rotation q becomes W q W⁻¹ */
export function bodyRig(joints: Record<string, THREE.Object3D>): Rig {
  return {
    has: (b) => !!JOINT_OF[b],
    set: (b, q) => {
      joints[JOINT_OF[b]!].quaternion.copy(WORLD_FROM_RIG).multiply(q).multiply(RIG_FROM_WORLD);
    },
    // rig (x, y, z) → world (-x, z, y): the same W, applied to a position
    hips: (p) => {
      joints.hips.position.set(-p.x * FIGURE_HIPS_M, p.z * FIGURE_HIPS_M, p.y * FIGURE_HIPS_M);
    },
  };
}
