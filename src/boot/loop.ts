/** One frame: input-driven motion, the room, scripts, then drawing. Also the stats line under the view. */
import type { Renderer } from "@/render/renderer";
import type { Bodies } from "./bodies";
import type { Core } from "./core";
import type { Mounted } from "./features";

const MAX_DT_S = 0.1;
const MAX_SKY_DT_S = 0.5;
const STATS_EVERY_S = 0.5;

export function startLoop(core: Core, renderer: Renderer, bodies: Bodies, mounted: Mounted, build: string): void {
  const stats = document.getElementById("stats");
  let prev = performance.now();
  let elapsed = 0;
  let frames = 0;
  const frame = (t: number) => {
    const real = (t - prev) / 1000;
    prev = t;
    step(Math.min(MAX_DT_S, real), real, { renderer, bodies, mounted });
    elapsed += real;
    frames++;
    if (elapsed > STATS_EVERY_S) {
      if (stats) stats.textContent = statsLine(core, Math.round(frames / elapsed), build);
      elapsed = 0;
      frames = 0;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

interface Parts {
  renderer: Renderer;
  bodies: Bodies;
  mounted: Mounted;
}

function step(dt: number, real: number, { renderer, bodies, mounted }: Parts): void {
  mounted.camera.update(dt);
  bodies.avatar.update(dt);
  bodies.peers.update(dt);
  bodies.session.tick(dt);
  bodies.runtime.tick(dt);
  bodies.physics.tick(dt);
  mounted.sound.update(dt);
  renderer.advance(dt, Math.min(real, MAX_SKY_DT_S));
  // after the camera moved, so the handles keep their size on screen
  mounted.manip.update();
  renderer.draw();
}

function statsLine(core: Core, fps: number, build: string): string {
  let triangles = 0;
  for (const o of core.store.world.objects) {
    if (!o.hidden) for (const f of o.mesh.f) triangles += f.length - 2;
  }
  const objects = core.store.world.objects.length;
  return `${fps} fps · ${objects} objects · ${triangles.toLocaleString("en-US")} triangles · v ${build}`;
}
