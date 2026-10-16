import { describe, expect, it } from "vitest";
import { GRACE_MS, Members, ROSTER_TTL_MS } from "./members";
import { Outbox, cutParts } from "./outbox";
import { Reassembly } from "./reassembly";
import { readBatch } from "./read";

function setup() {
  const log: string[] = [];
  const m = new Members({ join: (id) => log.push("+" + id), leave: (id) => log.push("-" + id) });
  return { m, log };
}

describe("room members, direct or through the relays", () => {
  it("joins direct peers at once and switches routes without leaving", () => {
    const { m, log } = setup();
    m.directUp("a");
    expect(m.route("a")).toBe("direct");
    m.heardFrom("a", 0);
    m.directDown("a", 1000);
    expect(m.route("a")).toBe("relay");
    m.directUp("a");
    expect(m.route("a")).toBe("direct");
    expect(log).toEqual(["+a"]);
  });

  it("gives a direct connection a moment before relaying, then relays", () => {
    const { m, log } = setup();
    m.heardFrom("b", 0);
    m.tick(GRACE_MS - 1);
    expect(m.route("b")).toBeNull();
    m.heardFrom("b", GRACE_MS - 1);
    m.tick(GRACE_MS + 1);
    expect(m.route("b")).toBe("relay");
    expect(m.relayTargets()).toEqual(["b"]);
    expect(log).toEqual(["+b"]);
  });

  it("relays at once to someone who already relays to us; drops the silent and those who say bye", () => {
    const { m, log } = setup();
    m.relayedNow("c", 0);
    m.relayedNow("d", 0);
    m.heardFrom("d", ROSTER_TTL_MS - 10);
    m.tick(ROSTER_TTL_MS + 1);
    expect(m.route("c")).toBeNull();
    expect(m.route("d")).toBe("relay");
    m.gone("d");
    m.directDown("x", 0);
    expect(log).toEqual(["+c", "+d", "-c", "-d"]);
  });
});

describe("the channel's outbox and parts", () => {
  const env = (n: string, t: string[] = [], j = "{}") => ({ o: "me", t, n, j, m: n + String(Math.random()).slice(2) });

  it("keeps only the latest avatar per destination, everything else in order", () => {
    const box = new Outbox();
    box.add(env("av", [], "1"));
    box.add(env("chat"));
    box.add(env("av", [], "2"));
    box.add(env("av", ["x"], "3"));
    expect(box.take().map((e) => e.n + e.j)).toEqual(["av2", "chat{}", "av3"]);
    expect(box.size).toBe(0);
  });

  it("cuts long payloads and puts them back together in any order", () => {
    const text = "QUJD".repeat(50);
    const parts = cutParts(text, 60, "id1");
    expect(parts.length).toBe(4);
    const r = new Reassembly();
    expect(r.add(parts[2], "a")).toBeNull();
    expect(r.add(parts[0], "a")).toBeNull();
    expect(r.add(parts[3], "a")).toBeNull();
    // someone else's part with the same id doesn't complete it
    expect(r.add(parts[1], "b")).toBeNull();
    expect(r.add(parts[1], "a")).toBe(text);
    expect(r.add("QUJD", "a")).toBe("QUJD");
  });

  it("reads only well-formed envelopes", () => {
    const good = env("hello", ["p1"]);
    const out = readBatch({ v: 1, e: [good, { ...good, o: "bad id!" }, { ...good, n: "<x>" }, null] });
    expect(out).toEqual([good]);
    expect(readBatch({ v: 2, e: [good] })).toEqual([]);
  });
});

describe("the channel's pace", () => {
  it("slows a step per burst of complaints, speeds up after a calm spell", async () => {
    const { Governor, STEPS_MS, isRateLimit } = await import("./governor");
    const g = new Governor();
    expect(g.pauseMs).toBe(STEPS_MS[0]);
    g.complaint(1000);
    g.complaint(1500);
    expect(g.level).toBe(1);
    g.complaint(5000);
    expect(g.level).toBe(2);
    g.tick(10_000);
    expect(g.level).toBe(2);
    g.tick(5000 + 17_000);
    expect(g.level).toBe(1);
    expect(isRateLimit("rate-limited: slow down")).toBe(true);
    expect(isRateLimit("blocked: not allowed")).toBe(false);
  });
});
