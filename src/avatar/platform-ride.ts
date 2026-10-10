/**
 * What you stand on, so a moving platform (a scripted lift) carries you along: remember the object under the
 * feet and where it was, and next frame move by as much as it moved.
 */
import * as THREE from "three";
import type { Collider } from "./collision";
import type { AvatarState } from "./state";

/** within this of the surface counts as standing on it, metres */
const STANDING_GAP_M = 0.05;
const PROBE_ABOVE_M = 0.3;

export class PlatformRide {
  private object: THREE.Object3D | null = null;
  private readonly at = new THREE.Vector3();
  private readonly now = new THREE.Vector3();

  /** before moving: follow the platform */
  carry(A: AvatarState): void {
    if (!this.object || !A.onGround || A.flying || A.sitting) return;
    this.object.getWorldPosition(this.now);
    A.pos.add(this.now.sub(this.at));
  }

  /** after moving: what's under the feet now (the ground itself never moves) */
  remember(A: AvatarState, collider: Collider, solids: THREE.Object3D[], ground: THREE.Object3D): void {
    const hit = collider.groundAt(A.pos.x, A.pos.y, A.pos.z + PROBE_ABOVE_M, solids);
    const standing = A.onGround && hit.object && hit.object !== ground && Math.abs(hit.z - A.pos.z) < STANDING_GAP_M;
    this.object = standing ? hit.object : null;
    if (this.object) this.object.getWorldPosition(this.at);
  }
}
