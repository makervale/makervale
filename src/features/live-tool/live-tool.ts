/**
 * Tools that work in the view. A live tool runs at once with its defaults, then the mouse adjusts its main
 * parameter (the wheel: the count), a click or Enter confirms, Esc or the right button takes it back. Pick tools
 * (loop cut without a selected edge, the knife) first wait for a click on the mesh.
 */
import * as THREE from "three";
import type { Params, ToolDef } from "@/app/tools";
import { adjustMove, adjustWheel } from "./adjust";
import type { Live, LiveDeps, LiveEnv } from "./env";
import { inView } from "./env";
import { liveKey } from "./keys";
import { cancelLive, confirmLive, startLive } from "./lifecycle";
import { hoverPick, pickClick } from "./pick";
import { useTool } from "./use-tool";

export class LiveTool {
  private readonly env: LiveEnv;

  constructor(deps: LiveDeps) {
    // the page may already have one
    const chip = document.getElementById("modechip") ?? deps.stage.appendChild(document.createElement("div"));
    chip.className = "modechip";
    chip.id = "modechip";
    chip.hidden = true;
    const helper = new THREE.Group();
    deps.renderer.parts.gizmoScene.add(helper);
    const canvas = deps.renderer.picker.canvas;
    this.env = { ...deps, canvas, chip, helper, cursor: { x: 0, y: 0 }, live: null };
    deps.bus.on("tool:use", ({ id, params }) => useTool(this.env, id, params));
    // a click anywhere outside the view (a panel, the menu) first keeps what the active tool did
    window.addEventListener("pointerdown", (e) => this.confirmOutside(e), true);
  }

  /** the tool active in the view, if any */
  current(): Live | null {
    return this.env.live;
  }

  active(): boolean {
    return this.env.live !== null;
  }

  /** activate a tool: live tools stay active until confirmed, the others just run */
  start(t: ToolDef, over?: Params): boolean {
    return startLive(this.env, t, over);
  }

  noteCursor(x: number, y: number): void {
    this.env.cursor.x = x;
    this.env.cursor.y = y;
  }

  move(x: number, y: number): void {
    this.noteCursor(x, y);
    const L = this.env.live;
    if (!L || !inView(this.env, x, y)) return;
    if (L.phase === "pick") hoverPick(this.env, x, y);
    else adjustMove(this.env, x, y);
  }

  click(x: number, y: number): void {
    this.noteCursor(x, y);
    const L = this.env.live;
    if (!L) return;
    if (L.phase === "adjust") confirmLive(this.env);
    else pickClick(this.env, x, y);
  }

  wheel(sign: number): void {
    adjustWheel(this.env, sign);
  }

  /** true when the key was used up */
  key(e: KeyboardEvent): boolean {
    return liveKey(this.env, e);
  }

  /** the camera moved: measure afresh from the next mouse move */
  rebase(): void {
    if (this.env.live) this.env.live.rebase = true;
  }

  confirm(): void {
    confirmLive(this.env);
  }

  cancel(): void {
    cancelLive(this.env);
  }

  private confirmOutside(e: PointerEvent): void {
    const target = e.target as HTMLElement | null;
    if (!this.env.live || target === this.env.canvas || target?.closest?.("#pie")) return;
    confirmLive(this.env);
  }
}
