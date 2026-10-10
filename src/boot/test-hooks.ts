/** What the end-to-end tests reach for (window.__sandbox). Not used by the app itself. */
import * as THREE from "three";
import type { Renderer } from "@/render/renderer";
import type { Bodies } from "./bodies";
import type { Core } from "./core";
import type { Mounted } from "./features";

export function exposeTestHooks(core: Core, renderer: Renderer, bodies: Bodies, mounted: Mounted, build: string): void {
  const { avatar } = bodies;
  Object.assign(window, {
    __sandbox: {
      build,
      ...core,
      renderer,
      session: bodies.session,
      scripts: bodies.runtime,
      physics: bodies.physics,
      sound: mounted.sound,
      avatar,
      manip: mounted.manip,
      live: () => mounted.live.current(),
      useTool: (id: string) => core.bus.emit("tool:use", { id }),
      gesture: (name: string) => core.bus.emit("gesture:play", { name }),
      sitAt: (x: number, y: number, z: number) => avatar.sitAt(new THREE.Vector3(x, y, z)),
      pickHandle: (x: number, y: number) => mounted.manip.pickHandle(x, y),
    },
  });
}
