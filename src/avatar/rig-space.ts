/**
 * The world is Z up and avatars face +Y; the animator works in VRM's convention (Y up, facing +Z). Every body
 * sits inside a wrapper that turns one into the other.
 */
import * as THREE from "three";

/** world-from-rig rotation: Rz(π)·Rx(π/2) */
export const WORLD_FROM_RIG = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI, "ZYX"));
export const RIG_FROM_WORLD = WORLD_FROM_RIG.clone().invert();
