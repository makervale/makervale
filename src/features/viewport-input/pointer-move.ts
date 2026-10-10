/** The pointer moves: drive the drag in progress, or show what a click would do (handle, element, touch). */
import type * as THREE from "three";
import { isOpen } from "@/ui/window";
import { moveCamera } from "./camera-drag";
import { pullFromElement } from "./pull";
import { rectBetween } from "./rubber";
import { touchableAt } from "./select";
import type { CamMode, InputCtx, Mods } from "./state";
import { camModeFromMods, setMods } from "./state";

/** a press that moves less than this is a click, pixels */
const SLOP_PX = 4;

/** what a move needs from a pointer event (touch moves are passed on as plain mouse moves) */
export interface PointerLike extends Mods {
  clientX: number;
  clientY: number;
  target: EventTarget | null;
}

export function pointerMove(ctx: InputCtx, e: PointerLike): void {
  const x = e.clientX;
  const y = e.clientY;
  ctx.last = { x, y };
  ctx.live.noteCursor(x, y);
  const dragging = !!ctx.track;
  if (ctx.live.active() && !dragging) {
    setMods(ctx, e);
    ctx.live.move(x, y);
    return;
  }
  if (!dragging) {
    setMods(ctx, e);
    if (e.target === ctx.canvas) hover(ctx, e, x, y);
    return;
  }
  dragMove(ctx, x, y);
}

function dragMove(ctx: InputCtx, x: number, y: number): void {
  const t = ctx.track!;
  const dx = x - t.x;
  const dy = y - t.y;
  t.x = x;
  t.y = y;
  if (!t.moved && Math.hypot(x - t.sx, y - t.sy) < SLOP_PX) return;
  t.moved = true;
  ctx.renderer.preselect.clear();
  const d = ctx.view;
  if (!d) {
    ctx.manip.move(x, y);
    return;
  }
  if (d.type === "cam") moveCamera(ctx, d, dx, dy);
  else if (d.type === "box") ctx.rubber.show(rectBetween(t.sx, t.sy, x, y));
  else if (d.type === "pull") {
    ctx.view = null;
    pullFromElement(ctx, d, x, y);
  }
}

/** hovering: light up the handle or the element under the cursor and pick the cursor shape */
function hover(ctx: InputCtx, e: Mods, x: number, y: number): void {
  const { store, manip, renderer } = ctx;
  const cam = camModeFromMods(e);
  const handle = manip.mode() && !cam ? manip.pickHandle(x, y) : null;
  manip.setHover(handle);
  const target = store.editTarget();
  const editing = !handle && !cam && store.toolMode === "edit";
  renderer.preselect.show(target, target && editing ? renderer.pickElement(x, y) : null);
  const touchy = !handle && !cam && !isOpen("build") && touchableAt(ctx, x, y);
  ctx.canvas.className = cursorClass(ctx, handle, cam, !!target, touchy);
}

function cursorClass(ctx: InputCtx, handle: THREE.Mesh | null, cam: CamMode | null, editing: boolean, touchy: boolean) {
  if (handle) return "c-handle";
  if (cam) return "c-" + cam;
  if (ctx.store.toolMode === "create") return "c-place";
  if (editing) return "c-elem";
  return touchy ? "c-touch" : "";
}
