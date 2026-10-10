/**
 * The bodies of the other people in a room. The net layer decides who is here, what they look like and where they
 * are going; drawing and animating them belongs to the avatar module, which implements `PeerBodies` (net never
 * touches three.js).
 */
import type { Look } from "@/avatar/look";
import type { BodySnapshot, Speaker } from "@/avatar/snapshot";

/** where an avatar is and what it is doing; sent a few times a second, eased towards on the other side */
export type AvatarSnapshot = BodySnapshot;
export type { Speaker };

export interface PeerBodies {
  /** make (or remake, keeping its place) the body of a peer; it stays hidden until its first target */
  create(id: string, name: string, look: Look): void;
  /** the peer changed only their name: update the label */
  rename(id: string, name: string): void;
  /** the peer left (or was removed): dispose the body */
  remove(id: string): void;
  /** where the body should go; the first target places it there at once and shows it */
  setTarget(id: string, target: AvatarSnapshot): void;
  /** play a gesture by name; unknown names are ignored (net only checks the shape of the name) */
  gesture(id: string, name: string, sitting: boolean): void;
  /** a speech bubble; for yourself this also starts the talking animation */
  say(who: Speaker, text: string): void;
  /** per frame: ease every body towards its target and animate it */
  update(dt: number): void;
}
