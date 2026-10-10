/** What the live tool works with, and the state of the tool that is active in the view. */
import type * as THREE from "three";
import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Store } from "@/app/store";
import type { ToolRunner } from "@/app/tool-runner";
import type { ParamDef, Params, ToolDef } from "@/app/tools";
import type { Renderer } from "@/render/renderer";
import type { Entry } from "@/world/history";
import type { Obj } from "@/world/model";

/** what live-tool borrows from the manipulators (mounted next to it) */
export interface ManipPort {
  pivotOf(objs: Obj[]): THREE.Vector3;
  /** one ruler step at a point along an axis, metres */
  snapUnit(p: THREE.Vector3, axis: THREE.Vector3): number;
  showBadge(x: number, y: number, text: string, snap: boolean): void;
  hideBadge(): void;
}

export interface LiveDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  runner: ToolRunner;
  renderer: Renderer;
  /** the viewport's stage: the mode chip goes in here */
  stage: HTMLElement;
  manip: ManipPort;
}

/** the screen direction a drag along the axis runs in, and pixels per metre along it */
export interface ScreenAxis {
  dir: THREE.Vector2;
  ppm: number;
}

export interface Live {
  tool: ToolDef;
  /** pick: waiting for a click on the mesh; adjust: the tool ran and the mouse changes it */
  phase: "pick" | "adjust";
  p: Params;
  /** the history entry of the last run; null when that run changed nothing */
  entry: Entry | null;
  pivot: THREE.Vector3;
  /** the world axis the mouse drives the parameter along */
  A?: THREE.Vector3;
  screenAxis?: ScreenAxis;
  /** the parameter and cursor when measuring started */
  p0: number;
  x0: number;
  y0: number;
  /** digits typed so far */
  buf: string;
  pending: Params | null;
  raf: number;
  /** measure afresh from the next move (after the camera moved) */
  rebase: boolean;
  /** started from a panel: wait for the cursor to rest in the view before measuring */
  settle: boolean;
  settleTimer: number;
  /** knife: the vertices clicked so far; set once the first cut opened the history entry */
  knife: { pts: number[] } | null;
}

export interface LiveEnv extends LiveDeps {
  canvas: HTMLCanvasElement;
  /** the one-line reminder at the top of the view */
  chip: HTMLElement;
  /** helpers drawn for the current parameters (a cutting plane) */
  helper: THREE.Group;
  cursor: { x: number; y: number };
  live: Live | null;
}

export function paramDef(t: ToolDef, key?: string): ParamDef | null {
  if (!key) return null;
  return (t.params ?? []).find((d) => d.key === key) ?? null;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function inView(env: LiveEnv, x: number, y: number): boolean {
  const r = env.canvas.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/** how far the mouse must travel for one unit of a screen-driven parameter */
export function sensitivity(d: ParamDef, metresPerPixel: number): number {
  if (d.unit === "m") return metresPerPixel;
  if (d.unit === "%") return 0.25;
  if (d.unit === "°") return 0.5;
  return (d.max - d.min) / 500;
}

/** the step Ctrl snaps a parameter to */
export function ctrlStep(d: ParamDef, metreStep: () => number): number {
  if (d.unit === "m") return metreStep();
  if (d.unit === "°" || d.unit === "%") return 5;
  return d.step * 5;
}
