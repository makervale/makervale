import { describe, expect, it } from "vitest";
import type { Vec3 } from "@/lib/vec";
import type { BallState, Contact, Hit } from "./index";
import { pushByPeople, rollQuat, speedOf, stepBall } from "./index";

const ball = { radius: 0.22, bounce: 0.6 };
const DT = 1 / 60;

/** a floor at z = 0 and, optionally, a wall at x = wallX */
function world(wallX?: number) {
  return (pos: Vec3, r: number): Contact[] => {
    const out: Contact[] = [];
    if (pos[2] < r) out.push({ normal: [0, 0, 1], depth: r - pos[2], id: null });
    if (wallX !== undefined && pos[0] > wallX - r)
      out.push({ normal: [-1, 0, 0], depth: pos[0] - (wallX - r), id: "wall" });
    return out;
  };
}

function run(s: BallState, seconds: number, probe = world()) {
  const hits: Hit[] = [];
  for (let t = 0; t < seconds; t += DT) hits.push(...stepBall(s, ball, DT, probe));
  return hits;
}

describe("ball", () => {
  it("falls, bounces lower each time, and comes to rest on the floor", () => {
    const s: BallState = { pos: [0, 0, 3], vel: [0, 0, 0] };
    const hits = run(s, 6);
    expect(hits.filter((h) => h.speed > 1).length).toBeGreaterThanOrEqual(2);
    expect(s.pos[2]).toBeCloseTo(ball.radius, 2);
    expect(speedOf(s)).toBeLessThan(0.2);
  });

  it("rolls to a clear stop on the floor, not a long creep", () => {
    const s: BallState = { pos: [0, 0, ball.radius], vel: [4, 0, 0] };
    run(s, 4.5);
    expect(s.vel[0]).toBe(0);
    expect(s.pos[0]).toBeGreaterThan(4);
    expect(s.pos[0]).toBeLessThan(10);
  });

  it("bounces back off a wall and reports what it hit", () => {
    const s: BallState = { pos: [0, 0, ball.radius], vel: [6, 0, 0] };
    const hits = run(s, 1.5, world(3));
    expect(s.vel[0]).toBeLessThan(0);
    expect(s.pos[0]).toBeLessThanOrEqual(3 - ball.radius + 1e-6);
    expect(hits.some((h) => h.id === "wall" && h.speed > 2)).toBe(true);
  });
});

describe("pushByPeople", () => {
  /** someone walking along +x from the origin, behind a ball `offset` metres off their line */
  function walkBehind(speed: number, offset: number, seconds: number) {
    const s: BallState = { pos: [1, offset, ball.radius], vel: [0, 0, 0] };
    const me: Vec3 = [0, 0, 0];
    let nearest = Infinity;
    let farthest = -Infinity;
    for (let t = 0; t < seconds; t += DT) {
      me[0] += speed * DT;
      pushByPeople(s, ball, [{ pos: me, vel: [speed, 0, 0] }]);
      stepBall(s, ball, DT, world());
      nearest = Math.min(nearest, s.pos[0] - me[0]);
      farthest = Math.max(farthest, s.pos[0] - me[0]);
    }
    return { s, nearest, farthest };
  }

  it("walking knocks the ball on a couple of metres, and you catch up with it", () => {
    const { nearest, farthest } = walkBehind(2.2, 0, 8);
    expect(nearest).toBeGreaterThan(0.3);
    expect(farthest).toBeGreaterThan(1.5);
    expect(farthest).toBeLessThan(3);
  });

  it("an off-centre dribble comes back to the line you walk along instead of slipping away", () => {
    const { s, nearest } = walkBehind(2.2, 0.3, 8);
    expect(nearest).toBeGreaterThan(0.3);
    expect(Math.abs(s.pos[1])).toBeLessThan(0.1);
  });

  it("running kicks the ball well ahead, with a little hop", () => {
    const s: BallState = { pos: [0.5, 0, ball.radius], vel: [0, 0, 0] };
    pushByPeople(s, ball, [{ pos: [0.1, 0, 0], vel: [5.2, 0, 0] }]);
    expect(s.vel[0]).toBeGreaterThan(5.2);
    expect(s.vel[2]).toBeGreaterThan(1);
    run(s, 10);
    expect(s.pos[0]).toBeGreaterThan(12);
  });

  it("a ball rolling into someone standing bounces off their legs, softly", () => {
    const s: BallState = { pos: [0.5, 0, ball.radius], vel: [-3, 0, 0] };
    pushByPeople(s, ball, [{ pos: [0, 0, 0], vel: [0, 0, 0] }]);
    expect(s.vel[0]).toBeGreaterThan(0);
    expect(s.vel[0]).toBeLessThan(3);
  });

  it("people far away, or flying overhead, don't touch it", () => {
    const s: BallState = { pos: [0, 0, ball.radius], vel: [0, 0, 0] };
    expect(pushByPeople(s, ball, [{ pos: [3, 0, 0], vel: [2, 0, 0] }])).toBe(false);
    expect(pushByPeople(s, ball, [{ pos: [0, 0, 3], vel: [2, 0, 0] }])).toBe(false);
  });
});

describe("rollQuat", () => {
  it("turns once for every circumference travelled", () => {
    let q: [number, number, number, number] = [0, 0, 0, 1];
    const r = 0.5;
    const steps = 100;
    for (let i = 0; i < steps; i++) q = rollQuat(q, [1, 0, 0], r, (2 * Math.PI * r) / steps);
    expect(Math.abs(q[3])).toBeCloseTo(1, 3);
  });

  it("stays put when still", () => {
    expect(rollQuat([0, 0, 0, 1], [0, 0, 0], 0.5, 0.1)).toEqual([0, 0, 0, 1]);
  });
});

describe("rolling over a small step", () => {
  it("a painted line does not make a rolling ball hop", () => {
    // the floor at z = 0, and a 1 cm high line across the way at x = 1
    const probe = (pos: Vec3, r: number): Contact[] => {
      const out: Contact[] = [];
      if (pos[2] < r) out.push({ normal: [0, 0, 1], depth: r - pos[2], id: null });
      const inLine = Math.abs(pos[0] - 1) < 0.05;
      if (inLine && pos[2] < r + 0.01) out.push({ normal: [0, 0, 1], depth: r + 0.01 - pos[2], id: "line" });
      return out;
    };
    const s: BallState = { pos: [0, 0, ball.radius], vel: [4, 0, 0] };
    let top = 0;
    for (let t = 0; t < 1; t += DT) {
      stepBall(s, ball, DT, probe);
      top = Math.max(top, s.pos[2]);
    }
    expect(top - ball.radius).toBeLessThan(0.03);
  });
});
