/**
 * The meeting point of the physics (features/physics) and the room. Like scripts, physics is decided by one peer,
 * the authority, which sends where moving bodies are and how fast they go; everyone else simulates the same bodies
 * in between, so the ball moves smoothly everywhere and reacts at once when you kick it.
 */
import type { Quat, Vec3 } from "@/lib/vec";

export interface BodyState {
  id: string;
  pos: Vec3;
  quat: Quat;
  vel: Vec3;
}

/** what net calls on the physics */
export interface PhysicsBridge {
  connect(hooks: PhysicsNetHooks): void;
  /** the authority says where these bodies are */
  applyRemote(states: BodyState[]): void;
}

/** what the physics calls on net */
export interface PhysicsNetHooks {
  /** does this computer decide where bodies go? (always, outside rooms) */
  isAuthority(): boolean;
  /** the authority's bodies moved (called a few times a second while any moves) */
  onMoved(states: BodyState[]): void;
  /** the other people in the room: their feet and velocity, so they can push the ball too */
  others(): { pos: Vec3; vel: Vec3 }[];
  /** physics moves objects every frame; those moves travel as BodyStates, not as edits */
  quietly(change: () => void): void;
}
