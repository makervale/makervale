/** Rays against the world for the avatar: the ground under a point, walls in the way, a backrest to lean on. */
import * as THREE from "three";
import { HIDDEN_LAYER } from "@/render/lod/lod";

/** the highest step you walk up without jumping, metres */
export const STEP_HEIGHT_M = 0.5;
/** how far from a wall the body stays, metres */
export const BODY_RADIUS_M = 0.28;
/** probe heights while walking: just above a step, the waist (fanned out sideways), the head */
const WALK_PROBES_M = [STEP_HEIGHT_M + 0.05, 1.0, 1.6];
const FLY_PROBES_M = [0.15, 0.9, 1.6];
const WAIST_M = 1.0;
const WAIST_FAN_M = [-0.2, 0, 0.2];
const DOWN_RAY_M = 200;
const BACKREST_HEIGHT_M = 0.35;
const BACKREST_REACH_M = 0.8;
const BACKREST_DIRECTIONS = 16;

export interface GroundHit {
  /** height of the ground, or -Infinity over the void */
  z: number;
  /** what is underneath, so a moving platform can carry you */
  object: THREE.Object3D | null;
}

export class Collider {
  private readonly ray = new THREE.Raycaster();

  constructor() {
    this.ray.firstHitOnly = true;
    // what is drawn simpler from afar is still solid as it is
    this.ray.layers.enable(HIDDEN_LAYER);
  }

  groundAt(x: number, y: number, fromZ: number, solids: THREE.Object3D[]): GroundHit {
    this.ray.set(new THREE.Vector3(x, y, fromZ), new THREE.Vector3(0, 0, -1));
    this.ray.far = DOWN_RAY_M;
    const h = this.ray.intersectObjects(solids, false)[0];
    return h ? { z: h.point.z, object: h.object } : { z: -Infinity, object: null };
  }

  /** would moving by `d` from `from` walk into something? `heights` overrides the probe heights */
  blocked(
    from: THREE.Vector3,
    d: THREE.Vector3,
    solids: THREE.Object3D[],
    flying: boolean,
    heights?: number[],
  ): boolean {
    const L = d.length();
    if (L < 1e-6) return false;
    const dir = d.clone().divideScalar(L);
    const side = new THREE.Vector3(dir.y, -dir.x, 0);
    for (const hz of heights ?? (flying ? FLY_PROBES_M : WALK_PROBES_M)) {
      for (const s of hz === WAIST_M ? WAIST_FAN_M : [0]) {
        this.ray.set(from.clone().add(new THREE.Vector3(side.x * s, side.y * s, hz)), dir);
        this.ray.far = L + BODY_RADIUS_M;
        if (this.ray.intersectObjects(solids, false).length) return true;
      }
    }
    return false;
  }

  /** the yaw that puts your back to the nearest thing around a seat (a backrest), or null */
  backrestYaw(seat: THREE.Vector3, solids: THREE.Object3D[]): number | null {
    let best = Infinity;
    let yaw: number | null = null;
    const from = seat.clone().add(new THREE.Vector3(0, 0, BACKREST_HEIGHT_M));
    for (let i = 0; i < BACKREST_DIRECTIONS; i++) {
      const a = (i * Math.PI * 2) / BACKREST_DIRECTIONS;
      this.ray.set(from, new THREE.Vector3(-Math.sin(a), Math.cos(a), 0));
      this.ray.far = BACKREST_REACH_M;
      const h = this.ray.intersectObjects(solids, false)[0];
      if (h && h.distance < best) {
        best = h.distance;
        yaw = a + Math.PI;
      }
    }
    return yaw;
  }

  /** the first thing between two points, as a distance along the way (camera against walls) */
  firstHit(from: THREE.Vector3, dir: THREE.Vector3, far: number, solids: THREE.Object3D[]): number | null {
    this.ray.set(from, dir);
    this.ray.far = far;
    const h = this.ray.intersectObjects(solids, false)[0];
    return h ? h.distance : null;
  }
}
