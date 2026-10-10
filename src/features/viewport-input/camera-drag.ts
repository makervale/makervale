/** Turning the camera with the mouse: orbit, pan, or Alt-zoom (sideways orbits, up/down zooms). */
import type { CamDrag, InputCtx } from "./state";

/** zoom factor per pixel dragged up or down */
const ZOOM_PER_PX = 0.99;

export function moveCamera(ctx: InputCtx, d: CamDrag, dx: number, dy: number): void {
  if (d.valid === false) return;
  const cam = ctx.renderer.camera;
  const radPerPx = (2 * Math.PI) / (ctx.canvas.clientWidth || 1);
  if (d.mode === "pan") {
    cam.pan(dx, dy);
    return;
  }
  if (dx) cam.orbitAround(-dx * radPerPx);
  if (!dy) return;
  if (d.mode === "zoom") cam.zoomIn(Math.pow(ZOOM_PER_PX, -dy));
  else cam.orbitOver(dy * radPerPx);
}
