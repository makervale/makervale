import type * as THREE from "three";
import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Manipulator, Store } from "@/app/store";
import type { ToolRunner } from "@/app/tool-runner";
import type { ToolDef } from "@/app/tools";
import type { Renderer } from "@/render/renderer";
import type { Obj } from "@/world/model";

/** the move / rotate / stretch handles (owned by features/manipulators) */
export interface ManipulatorPort {
  /** the handle that applies now: held Ctrl turns Move into Rotate, Ctrl+Shift into Stretch; one point only moves */
  effManip(): Manipulator;
  /** editing a mesh with a single point (or less) selected */
  singlePoint(): boolean;
  /** where the handles sit: the element selection's centre, the object, a group's root, or the bounds' centre */
  pivotOf(objs: Obj[]): THREE.Vector3;
}

/** the script runtime (owned by features/scripts); its errors change come as "scripts:errors" */
export interface ScriptsPort {
  scriptError(id: string): string | null;
  restartScript(id: string): void;
  /** the object's script reacts to touch */
  touchable(o: Obj): boolean;
}

/** the room you are in (owned by net); a change comes as "build:allowed" */
export interface RoomPort {
  canIBuild(): boolean;
}

/** pinned tools (the Tools panel's prefs) */
export interface PinsPort {
  pins(): string[];
  onChange(listener: () => void): () => void;
}

export interface BuildWindowDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  runner: ToolRunner;
  renderer: Pick<Renderer, "views" | "picker" | "highlights" | "framing">;
  manipulators: ManipulatorPort;
  scripts: ScriptsPort;
  room: RoomPort;
  pins: PinsPort;
  /** a tool's illustration as an image URL (features/tools-panel/preview/thumbs.ts draws them) */
  thumbnail(tool: ToolDef, size: number): string;
}
