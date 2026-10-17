import { describe, expect, it } from "vitest";
import { Bus } from "@/app/bus";
import { Commands } from "@/app/commands";
import { Store } from "@/app/store";
import { genBox } from "@/lib/mesh/generators";
import type { Vec3 } from "@/lib/vec";
import { add, mul3, rotate } from "@/lib/vec";
import type { Obj } from "@/world/model";
import { newObj } from "@/world/model";
import type { ScriptNetHooks } from "@/net/scripts-bridge";
import { mount, touchable } from "./index";
import { standaloneHooks } from "./deps";

function setup(script: string, hooks: Partial<ScriptNetHooks> = {}) {
  const store = new Store();
  const bus = new Bus();
  const notices: string[] = [];
  const commands = new Commands(store, bus, (t) => notices.push(t));
  const clock = { t: 100 };
  const o = newObj(store.world, genBox(1), [0, 0, 1], [1, 2, 1], { name: "Thing" });
  o.script = script;
  store.world.objects.push(o);
  const said: string[] = [];
  const moved: number[] = [];
  let quiet = 0;
  const runtime = mount({ store, bus, commands, now: () => clock.t, random: () => 0.5, myName: () => "Ann" });
  runtime.connect({
    ...standaloneHooks(),
    onSay: (_o, text) => said.push(text),
    onMoved: (fx) => moved.push(fx.d),
    quietly: (f) => {
      quiet++;
      f();
    },
    ...hooks,
  });
  /** advance the clock in small frames */
  const run = (seconds: number) => {
    for (let k = 0; k < Math.round(seconds / 0.05); k++) {
      clock.t += 0.05;
      runtime.tick(0.05);
    }
  };
  const obj = () => store.byId(o.id) as Obj;
  return { store, bus, commands, runtime, obj, run, said, moved, notices, quiet: () => quiet, clock };
}

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 4));

describe("script runtime", () => {
  it("knows which objects react to clicks", () => {
    expect(touchable({ script: "function onTouch(p) say(1) end" } as Obj)).toBe(true);
    expect(touchable({ script: "onTouch = function() end" } as Obj)).toBe(true);
    expect(touchable({ script: "function onStart() say(1) end" } as Obj)).toBe(false);
    expect(touchable(undefined)).toBe(false);
  });

  it("runs a door that turns about its hinge, and keeps the hinge in place", () => {
    const s = setup("pivot(-0.5, 0, 0)\nfunction onTouch(p)\n state.open = not state.open\n turn(0, 0, 90, 1)\nend");
    s.run(0.1);
    const hinge = (o: Obj): Vec3 => add(o.pos, rotate(mul3([-0.5, 0, 0], o.size), o.quat));
    const before = hinge(s.obj());
    s.bus.emit("object:touched", { id: s.obj().id });
    s.run(0.5);
    close(hinge(s.obj()), before);
    s.run(1);
    close(hinge(s.obj()), before);
    close(s.obj().quat, [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    expect(s.moved).toEqual([1]);
    expect(s.quiet()).toBeGreaterThan(0);
  });

  it("keeps state, home and pivot on the object, and brings them back after a restart", () => {
    const s = setup("pivot(0.5, 0, 0)\nfunction onTouch(p) state.clicks = (state.clicks or 0) + 1 state.last = p end");
    s.run(0.1);
    s.runtime.touch(s.obj().id, "Bob");
    s.runtime.touch(s.obj().id, "Bob");
    s.run(1);
    expect(s.obj().scriptState?.state).toEqual({ clicks: 2, last: "Bob" });
    expect(s.obj().scriptState?.home.pos).toEqual([0, 0, 1]);
    expect(s.obj().scriptState?.pivot).toEqual([0.5, 0, 0]);
    s.runtime.reset();
    s.runtime.resync();
    s.runtime.touch(s.obj().id, "Ann");
    s.run(1);
    expect(s.obj().scriptState?.state).toEqual({ clicks: 3, last: "Ann" });
  });

  it("forgets saved state when the script changes", () => {
    const s = setup("function onTouch() state.n = (state.n or 5) + 1 end");
    s.runtime.touch(s.obj().id, "Bob");
    s.run(1);
    expect(s.obj().scriptState?.state).toEqual({ n: 6 });
    s.commands.act(
      "Edit script",
      [s.obj().id],
      () => (s.obj().script = "function onTouch() state.n = (state.n or 5) + 2 end"),
    );
    s.runtime.touch(s.obj().id, "Bob");
    s.run(1);
    expect(s.obj().scriptState?.state).toEqual({ n: 7 });
  });

  it("lifts and comes home by itself", () => {
    const s = setup(
      'local busy = false\nfunction onTouch()\n if busy then return end\n busy = true\n say("Going up!")\n move(0, 0, 3, 1)\n wait(1)\n home(1)\n busy = false\nend',
    );
    s.bus.emit("object:touched", { id: s.obj().id });
    s.run(0.5);
    expect(s.runtime.tweenTarget(s.obj().id)?.pos).toEqual([0, 0, 4]);
    s.run(1);
    close(s.obj().pos, [0, 0, 4]);
    s.run(2);
    close(s.obj().pos, [0, 0, 1]);
    expect(s.runtime.tweenTarget(s.obj().id)).toBeNull();
    expect(s.said).toEqual(["Going up!"]);
  });

  it("fast clicks on a grow-and-shrink script end at the starting size", () => {
    const s = setup("function onTouch()\n  grow(1.2, 0.25)\n  grow(0.8333, 0.35)\nend");
    for (let k = 0; k < 30; k++) {
      s.bus.emit("object:touched", { id: s.obj().id });
      s.run(0.05);
    }
    s.run(3);
    close(
      s.obj().size,
      [1, 2, 1].map((v) => v * Math.pow(1.2 * 0.8333, 30)),
    );
  });

  it("a turn while another is still playing turns from where the first one ends", () => {
    const s = setup("function onTouch() turn(0, 0, 90, 1) end");
    s.bus.emit("object:touched", { id: s.obj().id });
    s.run(0.3);
    s.bus.emit("object:touched", { id: s.obj().id });
    s.run(2);
    close(s.obj().quat, [0, 0, 1, 0]);
  });

  it("hears a bump with the name of what struck it, and pushes physical objects", () => {
    const s = setup('function onBump(other)\n  say("ouch, " .. other)\n  push(0, 0, 5)\nend');
    const pushes: number[][] = [];
    s.bus.on("physics:push", ({ vel }) => pushes.push(vel));
    s.bus.emit("object:bumped", { id: s.obj().id, by: "ground", speed: 3 });
    s.run(0.1);
    expect(s.said).toEqual(["ouch, ground"]);
    expect(pushes).toEqual([[0, 0, 5]]);
  });

  it("kicks its object away from whoever touched it", () => {
    const s = setup("function onTouch(p) kick(p, 6) end", { avatars: () => [{ name: "Ann", pos: [0, -2, 0] }] });
    const pushes: number[][] = [];
    s.bus.on("physics:push", ({ vel }) => pushes.push(vel));
    s.bus.emit("object:touched", { id: s.obj().id });
    s.run(0.1);
    expect(pushes).toHaveLength(1);
    const [x, y, z] = pushes[0];
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(6);
    expect(z).toBeGreaterThan(0);
  });

  it("keeps objects within 100 m of home and sizes sane", () => {
    const s = setup("function onTouch() move(500, 0, 0) grow(1000) end");
    s.runtime.touch(s.obj().id, "x");
    s.run(0.1);
    close(s.obj().pos, [100, 0, 1]);
    expect(Math.max(...s.obj().size)).toBeLessThanOrEqual(200);
  });

  it("colours one material or all, and reports a bad colour once, in the console too", () => {
    const s = setup('function onTouch()\n color("red")\n glow(1.5, 2)\n color("nope")\nend');
    s.obj().materials.push({ ...s.obj().materials[0], name: "Second" });
    const changed: string[][] = [];
    s.runtime.connect({ ...standaloneHooks(), onChanged: (ids) => changed.push(ids) });
    s.runtime.touch(s.obj().id, "x");
    s.run(0.1);
    expect(s.obj().materials.map((m) => m.color)).toEqual(["#e03c2f", "#e03c2f"]);
    expect(s.obj().materials.map((m) => m.emissive)).toEqual([0, 1.5]);
    const message = 'line 4: "nope" is not a colour (use "#rrggbb" or a name like "red")';
    expect(s.runtime.error(s.obj().id)).toBe(message);
    expect(s.notices).toEqual([`Script on "Thing" stopped: ${message}`]);
    expect(s.runtime.output(s.obj().id)).toEqual(["error: " + message]);
    expect(changed.length).toBeGreaterThanOrEqual(2);
  });

  it("reports syntax errors and tries again after an edit", () => {
    const s = setup("function onTouch()\n explode(\nend");
    let told = 0;
    s.bus.on("scripts:errors", () => told++);
    s.runtime.resync();
    expect(s.runtime.error(s.obj().id)).toMatch(/line 3/);
    expect(s.runtime.runningCount).toBe(0);
    s.obj().script = "function onTouch() hide() end";
    s.runtime.restart(s.obj().id);
    expect(s.runtime.error(s.obj().id)).toBe("");
    expect(s.runtime.runningCount).toBe(1);
    expect(told).toBeGreaterThan(0);
    s.runtime.touch(s.obj().id, "x");
    s.run(0.1);
    expect(s.obj().hidden).toBe(true);
  });

  it("runs timers (every, after, cancel), near and hear, and prints to the console", () => {
    const s = setup(
      'n = 0\nlocal t = every(1, function() n += 1 end)\nafter(3.5, function() cancel(t) print("stopped at", n) end)\nfunction onNear(p) say("hi " .. p) end\nfunction onHear(p, text) if text:lower():find("open") then say(text) end end',
    );
    s.runtime.connect({
      ...standaloneHooks(),
      onSay: (_o, t) => s.said.push(t),
      avatars: () => [{ name: "Ann", pos: [0, 0, 2] }],
    });
    s.run(5.3);
    expect(s.runtime.running.get(s.obj().id)?.globals.get("n")).toBe(3);
    expect(s.runtime.output(s.obj().id)).toEqual(["stopped at\t3"]);
    s.runtime.hear("please OPEN up", "Bob");
    s.runtime.hear("nothing", "Bob");
    s.run(0.1);
    expect(s.said).toEqual(["hi Ann", "please OPEN up"]);
  });

  it("knows who steps on or into the object, and who leaves", () => {
    const where = { pos: [5, 0, 0] as Vec3 };
    const s = setup(
      'function onEnter(p) print("in " .. p) label(p .. " is here") end\nfunction onLeave(p) print("out " .. p) label() end',
      {
        avatars: () => [{ name: "Ann", pos: where.pos }],
      },
    );
    s.run(0.2);
    where.pos = [0.2, 0.5, 1.6];
    s.run(0.2);
    expect(s.obj().label).toBe("Ann is here");
    where.pos = [3, 0, 0];
    s.run(0.2);
    expect(s.runtime.output(s.obj().id)).toEqual(["in Ann", "out Ann"]);
    expect(s.obj().label).toBeUndefined();
  });

  it("objects talk with send and onMessage, each getting its own copy", () => {
    const s = setup('function onTouch(p) send("Bell", "ring", p, {n = 1}) end');
    const bell = newObj(s.store.world, genBox(1), [3, 0, 1], [1, 1, 1], { name: "Bell" });
    bell.script =
      'function onMessage(from, what, p, t) t.n += 1 say(from .. " " .. what .. " " .. p .. " " .. t.n) end';
    s.store.world.objects.push(bell);
    s.runtime.resync();
    s.runtime.touch(s.obj().id, "Ann");
    s.run(0.1);
    expect(s.said).toEqual(["Thing ring Ann 2"]);
  });

  it("spins and limits how much a script may say", () => {
    const s = setup('function onTouch() spin(0, 0, 9000) for i = 1, 30 do say("x") end end');
    s.runtime.touch(s.obj().id, "x");
    s.run(0.1);
    expect(s.obj().spin).toEqual([0, 0, 720]);
    expect(s.said.length).toBe(20);
  });

  it("away from the authority, forwards touches and runs nothing", () => {
    const forwarded: string[] = [];
    const s = setup("function onTouch() hide() end", {
      isAuthority: () => false,
      onForwardTouch: (id) => forwarded.push(id),
    });
    s.runtime.resync();
    s.bus.emit("object:touched", { id: s.obj().id });
    s.run(0.1);
    expect(forwarded).toEqual([s.obj().id]);
    expect(s.runtime.runningCount).toBe(0);
    expect(s.obj().hidden).toBe(false);
  });

  it("replays a smooth move sent by the authority", () => {
    const s = setup("");
    s.runtime.applyEffect({ id: s.obj().id, pos: [2, 0, 1], quat: [0, 0, 0, 1], size: [1, 2, 1], d: 1 });
    s.run(0.5);
    expect(s.obj().pos[0]).toBeGreaterThan(0.5);
    expect(s.obj().pos[0]).toBeLessThan(1.5);
    s.run(0.6);
    close(s.obj().pos, [2, 0, 1]);
  });

  it("gives a runaway loop a slice of every frame without freezing the others", () => {
    const s = setup('i = 0\nfunction onTouch() while true do i += 1 end end\nfunction onHear() say("still here") end');
    s.runtime.touch(s.obj().id, "x");
    s.run(0.5);
    s.runtime.hear("hello", "Bob");
    s.run(0.5);
    expect(s.runtime.running.get(s.obj().id)?.globals.get("i")).toBeGreaterThan(10000);
    expect(s.said).toEqual(["still here"]);
    expect(s.runtime.error(s.obj().id)).toBe("");
  });

  it("stops a script that holds more and more", () => {
    const s = setup("local all = {}\nwhile true do all[#all + 1] = {1, 2, 3} end");
    s.run(20);
    expect(s.runtime.runningCount).toBe(0);
    expect(s.runtime.error(s.obj().id)).toMatch(/holds too much/);
  });

  it("a move into a place that is too dense doesn't happen, and the script hears it", () => {
    const s = setup('function onTouch() move(40, 0, 0, 1) end\nfunction onBlocked() say("no room") end');
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
    const wall = newObj(s.store.world, fan, [40, 0, 1], [1, 1, 1], { name: "Dense" });
    s.store.world.objects.push(wall);
    s.commands.space.follow([wall.id, s.obj().id]);
    s.run(0.1);
    s.bus.emit("object:touched", { id: s.obj().id });
    s.run(1.5);
    expect(s.obj().pos[0]).toBeCloseTo(0);
    expect(s.said).toContain("no room");
    expect(s.runtime.note(s.obj().id)).toMatch(/Blocked/);
  });

  it("a greedy script rests once it has spent its gas for the second", () => {
    const s = setup(
      "function onStart()\n while true do\n  for i = 1, 20000 do state.n = (state.n or 0) + 1 end\n  wait(0)\n end\nend",
    );
    s.run(0.9);
    expect(s.runtime.gas.tiredScripts()).toContain(s.obj().id);
    const n = s.runtime.running.get(s.obj().id)!.globals.get("state");
    const count = (n as { get(k: string): unknown }).get("n");
    s.run(0.04);
    // resting: no more work this second
    expect((n as { get(k: string): unknown }).get("n")).toBe(count);
    expect(s.runtime.note(s.obj().id)).toMatch(/Resting/);
  });
});
