import { describe, expect, it } from "vitest";
import type { Ctx, Gen, Value } from "./index";
import {
  LuaError,
  Native,
  STEP_BUDGET,
  callFunction,
  fromPlain,
  measure,
  newCtx,
  newGlobals,
  parse,
  runChunk,
  toPlain,
} from "./index";

/** run a script to the end (waits pass at once); what it printed, one entry per print */
function run(src: string): string[] {
  const out: string[] = [];
  const c = newCtx(
    newGlobals(),
    (t) => out.push(t),
    () => 0.5,
  );
  drive(runChunk(parse(src), c), c);
  return out;
}

function drive(g: Gen<Value[]>, c: Ctx): Value[] {
  for (let i = 0; i < 1e6; i++) {
    c.steps = 0;
    const r = g.next();
    if (r.done) return r.value;
  }
  throw new Error("never ended");
}

const err = (src: string): string => {
  try {
    run(src);
  } catch (e) {
    return (e as Error).message;
  }
  return "no error";
};

describe("Lua", () => {
  it("does arithmetic with Lua's precedence and prints numbers like Lua", () => {
    expect(run("print(1 + 2 * 3, 2 ^ 3 ^ 2, -2 ^ 2, 7 // 2, 7 % 3, -7 % 3, 10 / 4, 1e300 * 1e10, 0.1 + 0.2)")).toEqual([
      "7\t512\t-4\t3\t1\t2\t2.5\tinf\t0.3",
    ]);
    expect(run('print("10" + 5, 3 == 3.0, "a" < "b", not nil, 1 and 2, nil or "x")')).toEqual([
      "15\ttrue\ttrue\ttrue\t2\tx",
    ]);
  });

  it("has math: min and max of several, floor, clamp, random in a range", () => {
    expect(run("print(math.min(3, 1, 2), math.max(4, 9), math.floor(-2.5), math.clamp(7, 0, 5), math.random(4, 4))")).toEqual([
      "1\t9\t-3\t5\t4",
    ]);
  });

  it("joins and slices text, with methods, format and `interpolation`", () => {
    const src = `
      local s = "Hello"
      print(s .. " " .. 42, #s, s:upper(), s:sub(2, -2), ("ab"):rep(3, "-"))
      print(string.format("%5.2f|%-3d|%s|%x|%03d", 3.14159, 7, "x", 255, 5))
      local who = "Ann"
      print(\`Hi {who}, {1 + 1} points\`)
      print(("a,b,,c"):split(",")[4], tostring(nil), tonumber("0x10"), tonumber("z", 36))`;
    expect(run(src)).toEqual([
      "Hello 42\t5\tHELLO\tell\tab-ab-ab",
      " 3.14|7  |x|ff|005",
      "Hi Ann, 2 points",
      "c\tnil\t16\t35",
    ]);
  });

  it("has tables: constructors, length, insert, remove, sort, concat, pairs in order, ipairs", () => {
    const src = `
      local t = {10, 20, 30, x = 1, ["y z"] = 2}
      table.insert(t, 40); table.insert(t, 1, 5)
      print(#t, table.remove(t), table.concat(t, ","))
      local names = {"cy", "al", "bo"}
      table.sort(names); print(table.concat(names, " "))
      table.sort(names, function(a, b) return a > b end); print(table.concat(names, " "))
      local keys = {}
      for k, v in pairs({a = 1, b = 2, c = 3}) do keys[#keys + 1] = k .. v end
      print(table.concat(keys, " "), table.find(names, "al"))
      for i, v in ipairs({"p", "q"}) do print(i, v) end`;
    expect(run(src)).toEqual(["5\t40\t5,10,20,30", "al bo cy", "cy bo al", "a1 b2 c3\t3", "1\tp", "2\tq"]);
  });

  it("has closures, recursion, several return values and varargs", () => {
    const src = `
      local function counter() local n = 0 return function() n += 1 return n end end
      local a, b = counter(), counter()
      a(); a()
      print(a(), b())
      local function fib(n) if n < 2 then return n end return fib(n - 1) + fib(n - 2) end
      print(fib(15))
      local function two() return 1, 2 end
      local t = {two(), two()}
      print(#t, select("#", two()), (two()))
      local function sum(...) local s = 0 for _, v in ipairs({...}) do s += v end return s, select("#", ...) end
      print(sum(1, 2, 3))`;
    expect(run(src)).toEqual(["3\t1", "610", "3\t2\t1", "6\t3"]);
  });

  it("has if/elseif, while, repeat (seeing the body's locals), for with steps, break and continue", () => {
    const src = `
      local out = {}
      for i = 10, 1, -3 do out[#out + 1] = i end
      for i = 1, 6 do if i % 2 == 0 then continue end out[#out + 1] = i end
      local n = 0
      repeat local again = n < 3; n += 1 until not again
      while true do n += 1 if n > 6 then break end end
      local kind = n > 10 and "big" or n > 5 and "mid" or "small"
      if kind == "big" then print("?") elseif kind == "mid" then print(table.concat(out, ","), n) else print("?") end`;
    expect(run(src)).toEqual(["10,7,4,1,1,3,5\t7"]);
  });

  it("has metatables for classes: __index, __tostring, __call, __newindex", () => {
    const src = `
      local Point = {}
      Point.__index = Point
      Point.__tostring = function(p) return "(" .. p.x .. ", " .. p.y .. ")" end
      function Point.new(x, y) return setmetatable({x = x, y = y}, Point) end
      function Point:length() return math.sqrt(self.x ^ 2 + self.y ^ 2) end
      local p = Point.new(3, 4)
      print(p:length(), tostring(p), getmetatable(p) == Point)
      local log = {}
      local spy = setmetatable({}, {__newindex = function(t, k, v) log[#log + 1] = k; rawset(t, k, v) end, __call = function(self, a) return a * 2 end})
      spy.a = 1; spy.a = 2
      print(#log, spy(21))`;
    expect(run(src)).toEqual(["5\t(3, 4)\ttrue", "1\t42"]);
  });

  it("catches errors with pcall, with the line they happened on", () => {
    const src = `
      local ok, e = pcall(function() error("boom") end)
      print(ok, e)
      local ok2, e2 = pcall(function() local t = nil; return t.x end)
      print(ok2, e2)
      print(pcall(error, {code = 7}))
      print(select(2, pcall(function() assert(false, "nope") end)))`;
    const out = run(src);
    expect(out[0]).toBe("false\tline 2: boom");
    expect(out[1]).toMatch(/^false\tline 4: can't read "x" from "t": it is nil/);
    expect(out[2]).toMatch(/^false\ttable: \d+$/);
    expect(out[3]).toBe("line 7: nope");
  });

  it("matches Lua patterns: find, match with captures, gsub with text, tables and functions, gmatch, %b, %f", () => {
    const src = `
      print(("hello world"):find("o w"), ("hello"):find("l+"), ("a.b"):find(".", 1, true))
      print(("key = value"):match("^(%w+)%s*=%s*(%w+)$"))
      print(("2024-10-17"):match("(%d+)-(%d+)-(%d+)"))
      print(("hello world"):gsub("o", "0"), ("abc"):gsub("%w", "%0%0"))
      print(("$name is $age"):gsub("%$(%w+)", {name = "Ann", age = 7}))
      print(("one two"):gsub("(%w+)", function(w) return w:upper() end))
      local words = {} for w in ("the quick  fox"):gmatch("%a+") do words[#words + 1] = w end
      print(table.concat(words, "|"), ("f(a(b)c)d"):match("%b()"), ("THE (quick) fox"):gsub("%f[%a]%a+", "x"))`;
    expect(run(src)).toEqual([
      "5\t3\t2\t2",
      "key\tvalue",
      "2024\t10\t17",
      "hell0 w0rld\taabbcc\t3",
      "Ann is 7\t2",
      "ONE TWO\t2",
      "the|quick|fox\t(a(b)c)\tx (x) x\t3",
    ]);
  });

  it("says what went wrong, and where", () => {
    expect(err("local x = 1\nfoo()")).toBe('line 2: "foo" isn\'t a function (it is nil)');
    expect(err("local t = {}\nprint(t.a.b)")).toBe('line 2: can\'t read "b" from the field "a": it is nil');
    expect(err("print(1 < 'a')")).toBe('line 1: can\'t compare number with the text "a"');
    expect(err("print('x' .. nil)")).toBe("line 1: can't join nil into text (use tostring)");
    expect(err("if x then\nprint(1)")).toBe(
      'line 2: expected "end" to close the "if" on line 1, but found the end of the script',
    );
    expect(err("x = = 1")).toBe('line 1: unexpected "="');
    expect(err("if a != b then end")).toBe('line 1: use "~=" for "not equal"');
    expect(err("print('open")).toBe("line 1: this text is missing its closing quote");
    expect(err("local function f() f() end f()")).toMatch(/too many calls inside each other/);
  });

  it("waits: a function hands { wait } to its host, and a busy loop lets the frame go now and then", () => {
    const g = newGlobals();
    g.set(
      "wait",
      new Native("wait", function* (a) {
        yield { wait: a[0] as number };
        return [];
      }),
    );
    const c = newCtx(g, () => {}, Math.random);
    drive(runChunk(parse("function onTouch(who) wait(2) seen = who end"), c), c);
    const touch = callFunction(g.get("onTouch"), ["Ann"], c, "onTouch");
    expect(touch.next().value).toEqual({ wait: 2 });
    expect(g.get("seen")).toBeUndefined();
    expect(touch.next().done).toBe(true);
    expect(g.get("seen")).toBe("Ann");
    const busy = newCtx(g, () => {}, Math.random);
    const loop = runChunk(parse("local n = 0 while true do n += 1 end"), busy);
    expect(loop.next().value).toEqual({ wait: 0 });
    expect(busy.steps).toBeGreaterThan(STEP_BUDGET);
  });

  it("measures how much a script holds, and copies plain values in and out", () => {
    const g = newGlobals();
    const c = newCtx(g, () => {}, Math.random);
    drive(runChunk(parse("big = {} for i = 1, 5000 do big[i] = {i} end"), c), c);
    expect(measure([g], 100_000)).toBeGreaterThan(10_000);
    const v = fromPlain({ scores: { Ann: 3, 2: "two" }, list: [1, 2, 3] });
    expect(toPlain(v, "state", 1)).toEqual({ scores: { Ann: 3, 2: "two" }, list: [1, 2, 3] });
    expect(() => toPlain(g, "state", 1)).toThrow(LuaError);
  });
});
