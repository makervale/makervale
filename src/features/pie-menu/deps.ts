import type * as THREE from "three";
import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Store } from "@/app/store";
import type { ToolRunner } from "@/app/tool-runner";
import type { Renderer } from "@/render/renderer";
import type { Obj } from "@/world/model";

/** your avatar (owned by the viewport / avatar code) */
export interface AvatarPort {
  readonly sitting: boolean;
  readonly name: string;
  sitAt(point: THREE.Vector3): void;
  standUp(): void;
  teleportTo(point: THREE.Vector3): void;
}

/** the script runtime (owned by features/scripts) */
export interface TouchPort {
  /** the object has a script that reacts to touch */
  touchable(o: Obj): boolean;
  touch(id: string, who: string): void;
}

export interface PieDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  runner: ToolRunner;
  renderer: Pick<Renderer, "picker" | "pickElement" | "camera">;
  avatar: AvatarPort;
  scripts: TouchPort;
}

export interface PieItem {
  label: string;
  run: () => void;
  disabled?: boolean;
}
