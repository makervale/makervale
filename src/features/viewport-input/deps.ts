/** What the viewport input needs, and the ports to the parts it drives (avatar, live tool, manipulators). */
import type * as THREE from "three";
import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Manipulator, Store } from "@/app/store";
import type { ToolRunner } from "@/app/tool-runner";
import type { Renderer } from "@/render/renderer";
import type { Obj } from "@/world/model";

/** your avatar (avatar/controller.ts) */
export interface AvatarPort {
  /** a key went down or up; true when it moves the avatar */
  key(e: KeyboardEvent, down: boolean): boolean;
  releaseKeys(): void;
  setShift(down: boolean): void;
  readonly sitting: boolean;
  readonly flying: boolean;
  standUp(): void;
  setFlying(on: boolean): void;
}

/** the tool active in the view (features/live-tool) */
export interface LivePort {
  active(): boolean;
  noteCursor(x: number, y: number): void;
  move(x: number, y: number): void;
  click(x: number, y: number): void;
  wheel(sign: number): void;
  /** true when the key was used up */
  key(e: KeyboardEvent): boolean;
  /** the camera moved: measure afresh */
  rebase(): void;
  confirm(): void;
  cancel(): void;
}

/** a drag of the manipulators; `touch` is the finger driving it */
export interface ManipDragPort {
  touch?: number;
}

/** the handles (features/manipulators) */
export interface ManipPort {
  readonly drag: ManipDragPort | null;
  mode(): Manipulator | null;
  pickHandle(x: number, y: number): THREE.Mesh | null;
  setHover(h: THREE.Mesh | null): void;
  startHandle(h: THREE.Mesh, x: number, y: number, shift: boolean): ManipDragPort;
  startGrab(g: { hitPoint: THREE.Vector3; x: number; y: number; shift: boolean; elem: boolean }): ManipDragPort;
  move(x: number, y: number): void;
  end(): void;
  cancel(): void;
  pivotOf(objs: Obj[]): THREE.Vector3;
}

/** the script runtime (features/scripts) */
export interface ScriptsPort {
  /** the object has a script that reacts to touch */
  touchable(o: Obj): boolean;
}

export interface InputDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  runner: ToolRunner;
  renderer: Renderer;
  avatar: AvatarPort;
  live: LivePort;
  manip: ManipPort;
  scripts: ScriptsPort;
  /** the viewport's stage (the box-select rectangle goes in here) */
  stage: HTMLElement;
}
