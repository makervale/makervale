/** What every part of the manipulators shares: the app, the three.js pieces it draws with, the badge and rulers. */
import type * as THREE from "three";
import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Store } from "@/app/store";
import type { Renderer } from "@/render/renderer";
import type { Badge } from "./badge";
import type { Rulers } from "./rulers";

export interface ManipDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  renderer: Renderer;
  /** the element the badge is placed in (the viewport's stage) */
  stage: HTMLElement;
}

export interface ManipEnv extends ManipDeps {
  camera: THREE.PerspectiveCamera;
  badge: Badge;
  rulers: Rulers;
}

/** metres per screen pixel at a world point */
export const worldPerPixel = (env: ManipEnv, p: THREE.Vector3): number => env.renderer.picker.worldPerPixel(p);
