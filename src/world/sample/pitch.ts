/**
 * A football pitch on the meadow north of the plaza: mown stripes, white lines, low boards the ball bounces off
 * (people step over them), two goals whose back nets count goals, and a football. Walk into it to dribble, run
 * into it to shoot.
 */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { faceCenter } from "@/lib/mesh/mesh";
import type { Vec3 } from "@/lib/vec";
import type { Mat } from "./palette";
import { WOOD } from "./palette";
import { GOAL_HALF_W, addGoal } from "./goal";
import type { SceneBuilder } from "./place";
import { box, join, move, rotZ, scale } from "./shapes";

/** centre of the pitch, and its half sizes (x across, y along) */
const CENTRE: Vec3 = [0, 27, 0];
const HALF_W = 7;
const HALF_L = 11;
const BOARD_H = 0.45;
const LINE = 0.1;
/** twice a real football, so it reads well from a distance */
const BALL_RADIUS = 0.22;
/** the turf stripes are 2 cm thick: the ball rests on them */
const TURF_TOP = 0.02;

const TURF: Mat = { name: "Turf", color: "#5fa04a", roughness: 0.95 };
const TURF_DARK: Mat = { name: "Turf (mown)", color: "#548f41", roughness: 0.95 };
const CHALK: Mat = { name: "Chalk", color: "#f4f4ee", roughness: 0.8 };
const RED_CORDS: Mat = { name: "Red net", color: "#f2a19a", roughness: 0.8, opacity: 0.85 };
const BLUE_CORDS: Mat = { name: "Blue net", color: "#a3bdf2", roughness: 0.8, opacity: 0.85 };
const BALL_WHITE: Mat = { name: "Ball leather", color: "#f4f2ec", roughness: 0.45 };
const BALL_DARK: Mat = { name: "Ball patches", color: "#22252b", roughness: 0.45 };

const BALL_SCRIPT = `// A football: walk into it to knock it on, run into it (Shift+W) to shoot, or click it to kick it away from you.
// Say "reset ball" in the chat to bring it back to the centre spot. After a goal it comes back by itself.
on touch {
  kick who, 7
}
on hear "reset ball" {
  say "Back to the centre spot!"
  home
}
on bump {
  if who == "North goal area" or who == "South goal area" {
    wait 1.5
    home
  }
}
`;
/** mown stripes across the pitch, then the lines: touch lines, goal lines, halfway line, centre circle */
function turf(): Mesh {
  const stripes: [Mesh, number][] = [];
  const n = 11;
  const w = (HALF_L * 2) / n;
  for (let i = 0; i < n; i++) stripes.push([box([HALF_W * 2, w, 0.02], [0, -HALF_L + w * (i + 0.5), 0]), i % 2]);
  return join(...stripes, ...lines());
}

function lines(): [Mesh, number][] {
  // box() stands on its z: the lines lie on the turf, which is 2 cm thick
  const z = 0.02;
  const at = (x: number, y: number): Vec3 => [x, y, z];
  const out: [Mesh, number][] = [
    [box([LINE, HALF_L * 2, 0.004], at(-HALF_W + 0.3, 0)), 2],
    [box([LINE, HALF_L * 2, 0.004], at(HALF_W - 0.3, 0)), 2],
    [box([HALF_W * 2 - 0.6, LINE, 0.004], at(0, -HALF_L + 0.3)), 2],
    [box([HALF_W * 2 - 0.6, LINE, 0.004], at(0, HALF_L - 0.3)), 2],
    [box([HALF_W * 2 - 0.6, LINE, 0.004], at(0, 0)), 2],
  ];
  // the centre circle: short straight pieces round a 2.5 m circle
  const pieces = 40;
  const r = 2.5;
  for (let i = 0; i < pieces; i++) {
    const a = (i / pieces) * Math.PI * 2;
    const piece = rotZ(box([LINE, (2 * Math.PI * r) / pieces + 0.02, 0.004]), (a * 180) / Math.PI);
    out.push([move(piece, at(Math.cos(a) * r, Math.sin(a) * r)), 2]);
  }
  return out;
}

/** the low boards round the pitch, with an opening at each goal */
function boards(): Mesh {
  const t = 0.12;
  const zc = 0;
  const endPiece = (sx: number, y: number) => {
    const len = HALF_W - GOAL_HALF_W - 0.2;
    return box([len, t, BOARD_H], [sx * (GOAL_HALF_W + 0.2 + len / 2), y, zc]);
  };
  return join(
    [box([t, HALF_L * 2, BOARD_H], [-HALF_W, 0, zc]), 0],
    [box([t, HALF_L * 2, BOARD_H], [HALF_W, 0, zc]), 0],
    [endPiece(-1, -HALF_L), 0],
    [endPiece(1, -HALF_L), 0],
    [endPiece(-1, HALF_L), 0],
    [endPiece(1, HALF_L), 0],
  );
}

/** the twelve corners of an icosahedron: where a football's dark pentagons sit */
const PHI = (1 + Math.sqrt(5)) / 2;
const CORNERS: Vec3[] = [
  [0, 1, PHI],
  [0, -1, PHI],
  [0, 1, -PHI],
  [0, -1, -PHI],
  [1, PHI, 0],
  [-1, PHI, 0],
  [1, -PHI, 0],
  [-1, -PHI, 0],
  [PHI, 0, 1],
  [-PHI, 0, 1],
  [PHI, 0, -1],
  [-PHI, 0, -1],
].map(([x, y, z]) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l] as Vec3;
});
/** how wide a patch is, as the cosine of its angular radius (about 19°) */
const PATCH_COS = Math.cos((19 * Math.PI) / 180);

/** a football: a finely divided icosphere, white, with the faces round each icosahedron corner dark */
function ball(): Mesh {
  const m = G.genIcosphere(3);
  m.fm = m.f.map((face) => {
    const c = faceCenter(m, face);
    const l = Math.hypot(c[0], c[1], c[2]) || 1;
    const near = CORNERS.some((k) => (k[0] * c[0] + k[1] * c[1] + k[2] * c[2]) / l > PATCH_COS);
    return near ? 1 : 0;
  });
  return scale(m, [BALL_RADIUS * 2, BALL_RADIUS * 2, BALL_RADIUS * 2]);
}

const offset = (x: number, y: number, z = 0): Vec3 => [CENTRE[0] + x, CENTRE[1] + y, CENTRE[2] + z];

export function addPitch(b: SceneBuilder): void {
  b.place(turf(), offset(0, 0), [TURF, TURF_DARK, CHALK], "Pitch");
  b.place(boards(), offset(0, 0), [WOOD], "Pitch boards");
  // the red goal is at the north end: a ball in it scores for Blue, and the other way round
  addGoal(b, offset(0, HALF_L), 1, "Blue", RED_CORDS);
  addGoal(b, offset(0, -HALF_L), -1, "Red", BLUE_CORDS);
  const o = b.place(ball(), offset(0, 0, TURF_TOP + BALL_RADIUS), [BALL_WHITE, BALL_DARK], "Ball");
  o.body = { shape: "ball", bounce: 0.6 };
  o.script = BALL_SCRIPT;
}
