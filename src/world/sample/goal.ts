/**
 * A football goal shaped like a real one: white round posts and crossbar, and a net that runs back a little from
 * the crossbar, then slopes down to the ground behind (so the side nets are trapezoids, not boxes). The net is made
 * of cords in the team's colour. The ground inside the goal is its own object with a script: the ball landing on it,
 * wholly over the line, is a goal.
 * Tall enough to walk into, so a ball that ends up inside can be fetched.
 */
import * as G from "@/lib/mesh/generators";
import { composeMatrix, transformMesh } from "@/lib/mesh/affine";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Quat, Vec3 } from "@/lib/vec";
import type { Mat } from "./palette";
import type { SceneBuilder } from "./place";
import { join } from "./shapes";

export const GOAL_HALF_W = 2.2;
const GOAL_H = 2.1;
/** how far back the net runs at the top, and at the ground */
const TOP_DEPTH = 0.7;
const GROUND_DEPTH = 1.7;
const POST_R = 0.06;
const SUPPORT_R = 0.025;
/** cords of the net: thickness, and the size of the mesh (smaller than the ball, so it can't slip through) */
const CORD = 0.012;
const MESH_GAP = 0.2;

const GOAL_PAINT: Mat = { name: "Goal paint", color: "#f3f3ef", roughness: 0.35 };
const GOAL_TURF: Mat = { name: "Turf", color: "#5fa04a", roughness: 0.95 };
/** the ball (radius 0.22) is wholly over the line once its centre is this far behind it */
const BALL_OVER_LINE = 0.25;

/** the turn that points +Z along `d` (a unit vector) */
function towards(d: Vec3): Quat {
  if (d[2] < -0.9999) return [1, 0, 0, 0];
  const q: Quat = [-d[1], d[0], 0, 1 + d[2]];
  const l = Math.hypot(...q);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

/** a straight piece from `a` to `b`: a round bar, or (thin and square) a cord */
function piece(a: Vec3, b: Vec3, width: number, round: boolean): Mesh {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const unit = round ? G.genCylinder(12) : G.genBox(1);
  return transformMesh(unit, composeMatrix(mid, towards([d[0] / len, d[1] / len, d[2] / len]), [width, width, len]));
}

const bar = (a: Vec3, b: Vec3, r = POST_R): Mesh => piece(a, b, r * 2, true);
/** a bar along the ground lies on it, not half in it */
const onGround = (p: Vec3): Vec3 => [p[0], p[1], SUPPORT_R];
const cord = (a: Vec3, b: Vec3): Mesh => piece(a, b, CORD, false);

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** a net over the quadrilateral a-b-c-d (in order round it): cords from edge ab to dc, and from ad to bc */
function net(a: Vec3, b: Vec3, c: Vec3, d: Vec3): Mesh[] {
  const across = (p: Vec3, q: Vec3) =>
    Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / MESH_GAP));
  const out: Mesh[] = [];
  const n = across(a, b);
  for (let i = 0; i <= n; i++) out.push(cord(lerp(a, b, i / n), lerp(d, c, i / n)));
  const m = across(a, d);
  for (let j = 0; j <= m; j++) out.push(cord(lerp(a, d, j / m), lerp(b, c, j / m)));
  return out;
}

/** the corners of one side (x = ±w): post foot, crossbar end, top back, ground back */
function sideCorners(x: number, out: number): Vec3[] {
  return [
    [x, 0, 0],
    [x, 0, GOAL_H],
    [x, TOP_DEPTH * out, GOAL_H],
    [x, GROUND_DEPTH * out, 0],
  ];
}

/** posts, crossbar, supports and the frame on the ground, with the side and top nets; `out` is ±1 (away from play) */
function frame(out: number): Mesh {
  const w = GOAL_HALF_W;
  const [lFoot, lTop, lBack, lGround] = sideCorners(-w, out);
  const [rFoot, rTop, rBack, rGround] = sideCorners(w, out);
  const bars = [
    bar(lFoot, lTop),
    bar(rFoot, rTop),
    bar(lTop, rTop),
    bar(lTop, lBack, SUPPORT_R),
    bar(rTop, rBack, SUPPORT_R),
    bar(lBack, lGround, SUPPORT_R),
    bar(rBack, rGround, SUPPORT_R),
    bar(onGround(lFoot), onGround(lGround), SUPPORT_R),
    bar(onGround(rFoot), onGround(rGround), SUPPORT_R),
    bar(onGround(lGround), onGround(rGround), SUPPORT_R),
  ];
  const nets = [
    ...net(lFoot, lTop, lBack, lGround),
    ...net(rFoot, rTop, rBack, rGround),
    ...net(lTop, rTop, rBack, lBack),
    ...net(lBack, rBack, rGround, lGround),
  ];
  return join(...bars.map((m): [Mesh, number] => [m, 0]), ...nets.map((m): [Mesh, number] => [m, 1]));
}

/**
 * The ground inside the goal, from just behind the line (the whole ball must be over it) to the back of the net.
 * Turf-coloured and 1 cm thick: you don't see it, the ball touching it scores.
 */
function goalArea(out: number): Mesh {
  const w = GOAL_HALF_W - 0.05;
  const from = BALL_OVER_LINE * out;
  const to = (GROUND_DEPTH - 0.05) * out;
  const y = (from + to) / 2;
  return transformMesh(G.genBox(1), composeMatrix([0, y, 0.005], [0, 0, 0, 1], [w * 2, Math.abs(to - from), 0.01]));
}

/** a goal on the end line at `at`, opening towards play; the ground inside it runs `script` */
export function addGoal(b: SceneBuilder, at: Vec3, out: 1 | -1, script: string, cords: Mat): void {
  const group = b.group();
  const name = out > 0 ? "North goal" : "South goal";
  b.place(frame(out), at, [GOAL_PAINT, cords], name, group);
  b.place(goalArea(out), at, [GOAL_TURF], name + " area", group).script = script;
}
