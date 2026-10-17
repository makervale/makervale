import { describe, expect, it } from "vitest";
import { Bus } from "@/app/bus";
import { Commands } from "@/app/commands";
import { Store } from "@/app/store";
import type { Vec3 } from "@/lib/vec";
import type { ScriptNetHooks } from "@/net/scripts-bridge";
import { mount } from "@/features/scripts";
import { standaloneHooks } from "@/features/scripts/deps";
import { sampleWorld } from "./index";

/** the start scene with its scripts running, people that can be put anywhere, and what got said */
function plaza() {
  const store = new Store();
  store.world = sampleWorld();
  const bus = new Bus();
  const commands = new Commands(store, bus, () => {});
  const clock = { t: 10 };
  let random = 0;
  const runtime = mount({ store, bus, commands, now: () => clock.t, random: () => (random = (random + 0.37) % 1) });
  const people = new Map<string, Vec3>();
  const said: string[] = [];
  const hooks: ScriptNetHooks = {
    ...standaloneHooks(),
    onSay: (o, text) => said.push(`${o.name}: ${text}`),
    avatars: () => [...people].map(([name, pos]) => ({ name, pos })),
  };
  runtime.connect(hooks);
  runtime.resync();
  const run = (s: number) => {
    for (let k = 0; k < Math.round(s / 0.05); k++) {
      clock.t += 0.05;
      runtime.tick(0.05);
    }
  };
  const named = (name: string) => store.world.objects.find((o) => o.name === name)!;
  const touch = (name: string, who: string) => runtime.touch(named(name).id, who);
  const standOn = (who: string, name: string) => {
    const o = named(name);
    people.set(who, [o.pos[0], o.pos[1], o.pos[2] + o.size[2] / 2]);
  };
  const errors = () =>
    store.world.objects.filter((o) => runtime.error(o.id)).map((o) => `${o.name}: ${runtime.error(o.id)}`);
  return { store, runtime, run, named, touch, standOn, people, said, errors };
}

describe("the plaza's games", () => {
  it("start without errors, and put up their signs", () => {
    const p = plaza();
    p.run(3);
    expect(p.errors()).toEqual([]);
    expect(p.named("Hall of Fame").label).toMatch(/^HALL OF FAME\nSky trail: nobody yet/);
    expect(p.named("Simon").label).toBe("SIMON\nClick me to play");
    expect(p.named("Start pad").label).toMatch(/SKY TRAIL/);
    expect(p.named("Scoreboard").label).toBe("RED 0 : 0 BLUE");
  });

  it("the guide greets a newcomer and answers in the chat", () => {
    const p = plaza();
    p.people.set("Ann", [2.6, -12, 0.3]);
    p.run(1);
    p.runtime.hear("help please", "Ann");
    p.run(0.5);
    expect(p.said.filter((s) => s.startsWith("Guide"))).toHaveLength(2);
    expect(p.errors()).toEqual([]);
  });

  it("the sky trail times a climb, and the record reaches the hall of fame", () => {
    const p = plaza();
    p.run(1);
    p.standOn("Ann", "Start pad");
    p.run(1);
    p.people.set("Ann", [0, -14, 0.3]);
    p.run(11);
    p.standOn("Ann", "Finish");
    p.run(2);
    expect(p.errors()).toEqual([]);
    expect(p.named("Finish").label).toMatch(/1\. Ann {2}12\.\d s/);
    expect(p.named("Hall of Fame").label).toMatch(/Sky trail: Ann, 12(\.\d)? s/);
  });

  it("Simon plays a tune, takes it back from the bells, and ends a game on a wrong bell", () => {
    const p = plaza();
    p.run(1);
    p.touch("Simon", "Bob");
    p.run(3);
    expect(p.named("Simon").label).toBe("SIMON\nBob: level 1");
    // the bell the orb rang is the one that glowed last: play every bell until the level goes up
    let level = 1;
    for (let n = 1; n <= 6 && level === 1; n++) {
      p.touch("Bell " + n, "Bob");
      p.run(0.5);
      if (p.named("Simon").label === "SIMON\nBob: level 2") level = 2;
    }
    expect(p.errors()).toEqual([]);
    expect(p.said.some((s) => s.startsWith("Simon: Oops!") || s.startsWith("Simon: Level 1 done!"))).toBe(true);
  });

  it("the chest counts gems per person and opens for all five", () => {
    const p = plaza();
    p.run(1);
    for (let n = 1; n <= 5; n++) {
      p.touch("Gem " + n, "Cy");
      p.run(0.5);
    }
    p.touch("Gem 2", "Dee");
    p.run(2);
    expect(p.errors()).toEqual([]);
    expect(p.said).toContain("Treasure chest: Cy found all 5 gems! The chest opens!");
    expect(p.named("Treasure chest").label).toBe("GEM HUNT\nFind the 5 glowing gems!\nCy: 5 of 5\nDee: 1 of 5");
    expect(p.named("Hall of Fame").label).toMatch(/Gem hunt: Cy, \d+ s/);
  });

  it("a goal counts on the scoreboard, for whoever kicked last", () => {
    const p = plaza();
    p.run(1);
    p.people.set("Eve", [0, 30, 0]);
    p.touch("Ball", "Eve");
    p.run(0.5);
    p.runtime.bump(p.named("North goal area").id, "Ball");
    p.run(1);
    expect(p.errors()).toEqual([]);
    expect(p.named("Scoreboard").label).toBe("RED 0 : 1 BLUE\nLast kick: Eve");
    expect(p.named("Hall of Fame").label).toMatch(/Football: Eve, 1 goals/);
  });
});
