import { describe, expect, it } from "vitest";
import { Bus } from "@/app/bus";
import { Commands } from "@/app/commands";
import { Store } from "@/app/store";
import { genIcosphere } from "@/lib/mesh/generators";
import type { Mover } from "@/lib/physics";
import type { ObjectViews } from "@/render/objects";
import type { Vec3 } from "@/lib/vec";
import { newObj } from "@/world/model";
import { Physics } from "./simulator";

/** a ball on an empty, endless floor, and someone who can walk into it */
function setup() {
  const store = new Store();
  const bus = new Bus();
  const commands = new Commands(store, bus);
  const ball = newObj(store.world, genIcosphere(1), [0, 1, 0.22], [0.44, 0.44, 0.44], { name: "Ball" });
  ball.body = { shape: "ball", bounce: 0.6 };
  store.world.objects.push(ball);
  let me: Mover | null = null;
  const views = { views: new Map() } as unknown as ObjectViews;
  const physics = new Physics({ store, bus, commands, views, self: () => me });
  const run = (seconds: number, walk?: () => Mover) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      me = walk ? walk() : null;
      physics.tick(1 / 60);
    }
  };
  return { ball: () => store.byId(ball.id)!, run, store, commands, physics };
}

/** something far heavier than the sand limit allows in one place */
function dense(store: Store, at: Vec3) {
  const fan = {
    v: [
      [0, 0, 0],
      [1, 0, 0],
    ] as Vec3[],
    f: [] as number[][],
    fm: [] as number[],
  };
  for (let i = 0; i < 44_000; i++) {
    fan.v.push([i / 44_000, 1, 0]);
    fan.f.push([0, 1, fan.v.length - 1]);
    fan.fm.push(0);
  }
  const o = newObj(store.world, fan, at, [1, 1, 1], { name: "Dense" });
  store.world.objects.push(o);
  return o;
}

describe("Physics", () => {
  it("a ball that has come to rest still rolls on after a kick, without the foot", () => {
    const { ball, run } = setup();
    run(3);
    const y0 = ball().pos[1];
    // walk along +y into the ball for a moment, then stop
    let y = 0;
    run(0.6, () => ({ pos: [0, (y += 2.2 / 60), 0], vel: [0, 2.2, 0] }));
    const atKick = ball().pos[1];
    run(4);
    expect(atKick).toBeGreaterThan(y0);
    expect(ball().pos[1] - atKick).toBeGreaterThan(2);
  });

  it("bounces off a place too full to take it, as off a wall", () => {
    const { ball, run, store, commands, physics } = setup();
    const wall = dense(store, [0, 30, 0.5]);
    commands.space.follow([wall.id, ball().id]);
    physics.push(ball().id, [0, 8, 0]);
    let furthest = 0;
    for (let i = 0; i < 6; i++) {
      run(0.5);
      furthest = Math.max(furthest, ball().pos[1]);
    }
    expect(furthest).toBeGreaterThan(6);
    // the window round the dense thing reaches 8 m out from its cell
    expect(furthest).toBeLessThan(24);
    expect(ball().pos[1]).toBeLessThan(furthest);
  });

  it("settles onto the floor when placed a little above it", () => {
    const { ball, run } = setup();
    ball().pos = [0, 1, 0.4];
    run(2);
    expect(ball().pos[2]).toBeCloseTo(0.22, 2);
  });
});
