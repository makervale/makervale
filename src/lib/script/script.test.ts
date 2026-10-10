import { describe, expect, it } from "vitest";
import { ScriptError, initGlobals, parse, startHandler } from "@/lib/script";
import type { Ctx, Yield } from "@/lib/script";

const ctx = (): Ctx => ({ vars: new Map(), local: {}, rand: () => 0.5, time: () => 0, steps: 0 });

/** run a handler to completion, collecting what it asks for */
function runAll(src: string, ev = "touch", local: Record<string, any> = {}, c = ctx()) {
  const p = parse(src);
  initGlobals(p, c);
  const out: Yield[] = [];
  for (const h of p.handlers.filter((h) => h.ev === ev)) {
    const g = startHandler(h, { ...c, local });
    for (let r = g.next(); !r.done; r = g.next()) {
      out.push(r.value as Yield);
      c.steps = 0;
    }
  }
  return { out, c };
}

describe("script language", () => {
  it("parses the door example and toggles", () => {
    const src = `var open = false
on touch {
  open = not open
  if open { turn 0, 0, 90 in 0.6 } else { turn 0, 0, -90 in 0.6 }
  say who + " used the door"
}`;
    const c = ctx();
    const r = runAll(src, "touch", { who: "Ann" }, c);
    expect(r.out).toEqual([
      { k: "act", n: "turn", a: [0, 0, 90], dur: 0.6, line: 4 },
      { k: "act", n: "say", a: ["Ann used the door"], dur: 0, line: 5 },
    ]);
    // globals are initialised once per run here, so check the toggle logic directly
    expect(c.vars.get("open")).toBe(true);
  });

  it("handles else-if chains, repeat, while, arithmetic and functions", () => {
    const src = `var n = 0
var s = ""
on start {
  repeat 3 { n += 2 }
  while n < 10 { n = n + 1 }
  if n == 9 { s = "nine" } else if n == 10 { s = "ten" } else { s = "other" }
  say s + " " + round(7 / 2) + " " + max(1, 5, 3) + " " + (10 % 3) + " " + random(0, 10)
}`;
    const { out, c } = runAll(src, "start");
    expect(c.vars.get("n")).toBe(10);
    expect(out[0]).toMatchObject({ n: "say", a: ["ten 4 5 1 5"] });
  });

  it("waits and moves", () => {
    const { out } = runAll('on timer 2 {\n move 0, 0, 1 in 1\n wait 0.5\n color "#ff0000"\n}', "timer");
    expect(out.map((o) => (o.k === "act" ? o.n : "wait:" + o.s))).toEqual(["move", "wait:0.5", "color"]);
  });

  it("reports helpful errors with line numbers", () => {
    expect(() => parse("on touch {\n  explode\n}")).toThrow(/line 2/);
    expect(() => parse("on fly { }")).toThrow(/not an event/);
    expect(() => parse('on touch { say "hi }')).toThrow(ScriptError);
    expect(() => parse("on touch { glow 1 in 2 }")).toThrow(/can't take "in"/);
    expect(() => runAll("on touch { x = 1 }")).toThrow(/isn't declared|has no value/);
    expect(() => runAll("var a = 1\non touch { a = a / 0 }")).toThrow(/division by zero/);
  });

  it("stops runaway loops by yielding and never runs forever without waiting", () => {
    const p = parse("var i = 0\non touch { while true { i += 1 } }");
    const c = ctx();
    initGlobals(p, c);
    const g = startHandler(p.handlers[0], c);
    let yields = 0;
    for (let k = 0; k < 20; k++) {
      const r = g.next();
      if (!r.done) yields++;
      c.steps = 0;
    }
    expect(yields).toBe(20);
    expect((c.vars.get("i") as number) > 1000).toBe(true);
  });

  it("accepts hear with a word and near with a distance", () => {
    const p = parse('on hear "open" { say heard }\non near 3 { say "hi " + who }\non hear { stop }');
    expect(p.handlers.map((h) => h.ev)).toEqual(["hear", "near", "hear"]);
  });

  it("limits source size and nesting", () => {
    expect(() => parse("var a = 1\n".repeat(2000))).toThrow(/at most/);
    expect(() => parse("var a = " + "(".repeat(100) + "1" + ")".repeat(100))).toThrow(/nested/);
  });
});
