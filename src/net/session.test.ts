import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Bus } from "@/app/bus";
import { Commands } from "@/app/commands";
import { Store } from "@/app/store";
import { DEFAULT_LOOK } from "@/avatar/look";
import { newObj } from "@/world/model";
import type { TransportHooks } from "./transport";

/* a fake room connection: records what is sent, lets the test deliver messages and peers */
const wire = vi.hoisted(() => ({
  sent: [] as { name: string; data: any; target?: string }[],
  handlers: new Map<string, (d: unknown, from: string) => void>(),
  hooks: null as TransportHooks | null,
  dropped: [] as string[],
}));

vi.mock("./transport", () => ({
  selfId: "me",
  openTransport: (_id: string, hooks: TransportHooks) => {
    wire.hooks = hooks;
    return {
      send: (name: string, data: unknown, target?: string) => wire.sent.push({ name, data, target }),
      on: (name: string, f: (d: unknown, from: string) => void) =>
        wire.handlers.set(name, (d, from) => hooks.accept(from) && f(d, from)),
      requestFile: async () => null,
      routeOf: () => "direct",
      relaySlowdown: () => 0,
      knowVisitKey: () => {},
      drop: (pid: string) => wire.dropped.push(pid),
      leave: async () => {},
    };
  },
}));
vi.mock("./relays", () => ({
  relaysReady: async () => [],
  currentRelays: () => [],
  relayStatus: () => ({}),
  onRelayStatus: () => () => {},
}));
const listing = vi.hoisted(() => ({ announce: vi.fn(), refreshAnnouncement: vi.fn(), withdraw: vi.fn() }));
vi.mock("./public-rooms", () => ({ ...listing, browsePublicRooms: vi.fn() }));

const { createSession } = await import("./session");

const tri = () => ({
  v: [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ] as [number, number, number][],
  f: [[0, 1, 2]],
  fm: [0],
});
const deliver = (name: string, data: unknown, from: string) => wire.handlers.get(name)!(data, from);
const sentNames = () => wire.sent.map((m) => m.name);
/** our key owns the room, but the visit its rules name as host isn't here: the room runs on its builders */
const ownerAway = (session: { net: { rules: unknown } }) =>
  void ((session.net.rules as { host: string }).host = "elsewhere");

function setup() {
  const store = new Store();
  const bus = new Bus();
  const commands = new Commands(store, bus);
  const keys = new Map<string, string>();
  const peers = {
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    setTarget: vi.fn(),
    gesture: vi.fn(),
    say: vi.fn(),
    update: vi.fn(),
  };
  const scripts = {
    connect: vi.fn(),
    touch: vi.fn(),
    hear: vi.fn(),
    applyEffect: vi.fn(),
    settledTarget: () => null,
    resync: vi.fn(),
    reset: vi.fn(),
  };
  const avatar = {
    pos: [0, 0, 0] as [number, number, number],
    yaw: 0,
    speed: 0,
    back: false,
    talking: false,
    flying: false,
    sitting: false,
    onGround: true,
    turn: 0,
    climb: 0,
  };
  const events: string[] = [];
  for (const e of ["room:joined", "room:left", "build:allowed"] as const) bus.on(e, () => events.push(e));
  const session = createSession({
    store,
    bus,
    commands,
    peers,
    scripts,
    physics: { connect: vi.fn(), applyRemote: vi.fn() },
    localAvatar: () => avatar,
    selfName: () => "Me",
    selfLook: () => ({ ...DEFAULT_LOOK }),
    keyStore: { get: (k) => keys.get(k) ?? null, set: (k, v) => void keys.set(k, v) },
  });
  return { store, bus, commands, session, peers, scripts, events };
}

beforeEach(() => {
  wire.sent.length = 0;
  wire.dropped.length = 0;
  wire.handlers.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("session", () => {
  it("hosts a room with the current scene and gives it back on leaving", async () => {
    const { store, session, events } = setup();
    store.world.objects.push(newObj(store.world, tri(), [0, 0, 0], [1, 1, 1]));
    const id = await session.host("Test", "private");
    expect(id).toMatch(/^[a-z2-9]{12}$/);
    expect(session.inRoom()).toBe(true);
    expect(session.net.synced).toBe(true);
    expect(session.net.chat[0].text).toContain("Test");
    expect(events).toContain("room:joined");
    expect(session.net.rules?.host).toBe("me");
    expect(session.amOwner()).toBe(true);
    store.world.objects = [];
    await session.leave();
    expect(store.world.objects.length).toBe(1);
    expect(events).toContain("room:left");
    expect(session.inOwnScene()).toBe(true);
  });

  it("sends local edits, applies peers' edits without echoing them", async () => {
    const { store, commands, session } = setup();
    await session.host("Test", "private");
    vi.useFakeTimers();
    let id = "";
    commands.act("add", [], () => {
      const o = newObj(store.world, tri(), [0, 0, 0], [1, 1, 1]);
      store.world.objects.push(o);
      id = o.id;
    });
    commands.act("move", [id], () => (store.byId(id)!.pos = [1, 1, 1]));
    vi.advanceTimersByTime(100);
    const objs = wire.sent.filter((m) => m.name === "objs");
    expect(objs.length).toBe(1);
    expect(objs[0].data.set.map((o: any) => [o.id, o.pos])).toEqual([[id, [1, 1, 1]]]);
    expect(objs[0].data.order).toEqual([id]);
    const ver = session.net.ver;
    wire.sent.length = 0;
    const theirs = { ...newObj({ seq: 50, objects: [] }, tri(), [5, 5, 5], [1, 1, 1]) };
    deliver("objs", { set: [theirs], del: [], order: [], ver: 0 }, "p1");
    vi.advanceTimersByTime(100);
    expect(store.byId(theirs.id)?.pos).toEqual([5, 5, 5]);
    expect(sentNames()).not.toContain("objs");
    expect(session.net.ver).toBe(ver + 1);
  });

  it("greets newcomers and sends them the scene", async () => {
    const { session, peers } = setup();
    await session.host("Test", "private");
    wire.hooks!.onPeerJoin("p1");
    expect(wire.sent.filter((m) => m.target === "p1").map((m) => m.name)).toEqual(["hello", "av"]);
    deliver("hello", { name: "Ann", look: {}, synced: false, ver: 0 }, "p1");
    expect(peers.create).toHaveBeenCalledWith("p1", "Ann", expect.any(Object));
    expect(wire.sent.at(-1)).toMatchObject({ name: "snap", target: "p1" });
    expect(session.net.peers.get("p1")?.name).toBe("Ann");
  });

  it("a reopened copy gives way to someone who stayed in the room, whatever the counters say", async () => {
    const { store, session } = setup();
    store.world.objects.push(newObj(store.world, tri(), [0, 0, 0], [1, 1, 1]));
    const id = await session.host("Test", "private");
    // my copy got far ahead in its own count (counters are per browser), then I left
    store.world.objects.push(newObj(store.world, tri(), [1, 0, 0], [1, 1, 1]));
    (session.net as { ver: number }).ver = 500;
    await session.leave();
    await session.join(id);
    expect(session.net.synced).toBe(true);
    // the room went on without me: a live copy with a lower count
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 7, fresh: false }, "p1");
    expect(session.net.synced).toBe(false);
    expect(wire.sent.at(-1)).toMatchObject({ name: "hello", data: { synced: false } });
  });

  it("between two reopened copies the higher version wins", async () => {
    const { store, session } = setup();
    store.world.objects.push(newObj(store.world, tri(), [0, 0, 0], [1, 1, 1]));
    const id = await session.host("Test", "private");
    (session.net as { ver: number }).ver = 50;
    await session.leave();
    await session.join(id);
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 7, fresh: true }, "p1");
    expect(session.net.synced).toBe(true);
    wire.hooks!.onPeerJoin("p2");
    deliver("hello", { name: "Bob", look: {}, synced: true, ver: 80, fresh: true }, "p2");
    expect(session.net.synced).toBe(false);
  });

  it("kick: tells everyone first, hangs up on the peer 2.5 s later, ignores them meanwhile", async () => {
    const { session, peers } = setup();
    await session.host("Test", "private");
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", synced: true, ver: 1 }, "p1");
    vi.useFakeTimers();
    wire.sent.length = 0;
    await session.kick("p1");
    expect(wire.sent[0].name).toBe("hello");
    expect(wire.sent[0].data.rules.banned).toEqual(["peer:p1"]);
    expect(peers.remove).toHaveBeenCalledWith("p1");
    expect(wire.dropped).toEqual([]);
    vi.advanceTimersByTime(2500);
    expect(wire.dropped).toEqual(["p1"]);
    expect(wire.hooks!.accept("p1")).toBe(false);
  });

  it("owner-only building drops others' edits", async () => {
    const { store, session } = setup();
    await session.host("Test", "private");
    await session.setEveryoneBuilds(false);
    expect(session.net.rules?.build).toBe("owner");
    expect(session.canIBuild()).toBe(true);
    expect(session.canBuild("p1")).toBe(false);
    wire.hooks!.onPeerJoin("p1");
    const theirs = newObj({ seq: 50, objects: [] }, tri(), [5, 5, 5], [1, 1, 1]);
    deliver("objs", { set: [theirs], del: [], order: [], ver: 0 }, "p1");
    expect(store.byId(theirs.id)).toBeUndefined();
  });

  it("chat goes to the room, to the scripts and over my head", async () => {
    const { session, peers, scripts } = setup();
    await session.host("Test", "private");
    session.say("  hello\u0000 ");
    expect(wire.sent.at(-1)).toMatchObject({ name: "chat", data: { text: "hello" } });
    expect(scripts.hear).toHaveBeenCalledWith("hello", "Me");
    expect(peers.say).toHaveBeenCalledWith({ kind: "self" }, "hello");
    expect(session.net.chat.at(-1)).toMatchObject({ text: "hello", self: true });
  });

  it("the owner lets one person build, and their changes can be undone after they left", async () => {
    const { store, session } = setup();
    await session.host("Test", "private");
    await session.setEveryoneBuilds(false);
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "p1");
    await session.letBuild("p1", true);
    expect(session.canBuild("p1")).toBe(true);
    const theirs = newObj({ seq: 50, objects: [] }, tri(), [5, 5, 5], [1, 1, 1]);
    deliver("objs", { set: [theirs], del: [], order: [], ver: 0 }, "p1");
    expect(store.byId(theirs.id)).toBeDefined();
    wire.hooks!.onPeerLeave("p1");
    expect(session.changers()).toMatchObject([{ name: "Ann", objects: 1, here: "" }]);
    expect(session.undoPerson(session.changers()[0].who)).toBe(1);
    expect(store.byId(theirs.id)).toBeUndefined();
  });

  it("undoing a person's drags puts the object back where it was before their first one", async () => {
    const { store, session } = setup();
    const mine = newObj(store.world, tri(), [1, 1, 1], [1, 1, 1]);
    store.world.objects.push(mine);
    await session.host("Test", "private");
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "p1");
    // while dragging, the room sees the move as it happens; the drop is an ordinary edit
    const xf = (x: number) => ({ id: mine.id, pos: [x, 1, 1], quat: mine.quat, size: mine.size });
    deliver("xf", { objs: [xf(3)] }, "p1");
    deliver("xf", { objs: [xf(6)] }, "p1");
    deliver("objs", { set: [{ ...structuredClone(mine), pos: [7, 1, 1] }], del: [], order: [], ver: 0 }, "p1");
    // and a second drag of the same object: undo goes back past both
    deliver("xf", { objs: [xf(9)] }, "p1");
    deliver("objs", { set: [{ ...structuredClone(mine), pos: [10, 1, 1] }], del: [], order: [], ver: 0 }, "p1");
    expect(store.byId(mine.id)!.pos[0]).toBe(10);
    expect(session.undoPerson(session.changers()[0].who)).toBe(1);
    expect(store.byId(mine.id)!.pos[0]).toBe(1);
  });

  it("a public room runs on its owner, is listed while the owner is in, and guests watch", async () => {
    const { session } = setup();
    await session.host("Plaza", "public");
    expect(session.amAuthority()).toBe(true);
    wire.hooks!.onPeerJoin("a0");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "a0");
    // the smallest id would run a private room; a public one stays with its owner
    expect(session.authorityId()).toBe("me");
    expect(session.canBuild("a0")).toBe(false);
    session.tick(2);
    expect(listing.announce).toHaveBeenCalled();
    await session.leave();
    expect(listing.withdraw).toHaveBeenCalled();
  });

  it("an object deleted many times over, or set and deleted at once, is counted out of the laws only once", async () => {
    const { store, session, commands } = setup();
    const fan = (n: number) => {
      const v: [number, number, number][] = [
        [0, 0, 0],
        [1, 0, 0],
      ];
      const f: number[][] = [];
      for (let i = 0; i < n; i++) {
        v.push([i / n, 1, 0]);
        f.push([0, 1, v.length - 1]);
      }
      return { v, f, fm: f.map(() => 0) };
    };
    const mine = newObj(store.world, fan(10_000), [0, 0, 0], [1, 1, 1]);
    commands.replaceWorld({ seq: store.world.seq, objects: [mine] }, "Open");
    await session.host("Test", "private");
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "p1");
    const huge = newObj({ seq: 50, objects: [] }, fan(50_000), [0, 0, 0], [1, 1, 1]);
    deliver("objs", { set: [huge], del: Array(20).fill(mine.id), order: [], ver: 0 }, "p1");
    expect(store.byId(huge.id)).toBeUndefined();
    expect(store.byId(mine.id)).toBeDefined();
    deliver("objs", { set: [{ ...huge, id: mine.id }], del: [mine.id, mine.id], order: [], ver: 0 }, "p1");
    expect(store.byId(mine.id)!.mesh.f.length).toBe(10_000);
  });

  it("an edit that breaks the laws of space is refused, and the room's keeper sends its own copy back", async () => {
    vi.useFakeTimers();
    const { store, session, commands } = setup();
    await session.host("Test", "private");
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "p1");
    const fan = () => {
      const v: [number, number, number][] = [
        [0, 0, 0],
        [1, 0, 0],
      ];
      const f: number[][] = [];
      for (let i = 0; i < 50_000; i++) {
        v.push([i / 50_000, 1, 0]);
        f.push([0, 1, v.length - 1]);
      }
      return { v, f, fm: f.map(() => 0) };
    };
    const theirs = newObj({ seq: 50, objects: [] }, fan(), [0, 0, 0], [1, 1, 1]);
    wire.sent.length = 0;
    // a guest can't pass it off as a whole scene: only the owner's are taken as they are
    deliver("objs", { set: [theirs], del: [], order: [], ver: 0, whole: 1 }, "p1");
    expect(store.byId(theirs.id)).toBeUndefined();
    vi.advanceTimersByTime(100);
    expect(wire.sent.find((m) => m.name === "objs")?.data.del).toContain(theirs.id);
    // in a room nobody brings in a scene over the law, its owner included: it doesn't stand, and doesn't go out
    wire.sent.length = 0;
    const heavy = newObj({ seq: 60, objects: [] }, fan(), [0, 0, 0], [1, 1, 1]);
    commands.replaceWorld({ seq: 60, objects: [heavy] }, "Open");
    vi.advanceTimersByTime(100);
    expect(store.byId(heavy.id)).toBeUndefined();
    const sentIds = wire.sent
      .filter((m) => m.name === "objs")
      .flatMap((m) => m.data.set.map((o: { id: string }) => o.id));
    expect(sentIds).not.toContain(heavy.id);
  });

  it("a drop into a place too full goes back to where the drag started", async () => {
    const { store, session, commands } = setup();
    const dense = newObj(store.world, tri(), [40, 0, 0], [1, 1, 1]);
    for (let i = 0; i < 50_000; i++) {
      dense.mesh.v.push([i / 50_000, 1, 0]);
      dense.mesh.f.push([0, 1, dense.mesh.v.length - 1]);
      dense.mesh.fm.push(0);
    }
    const mine = newObj(store.world, tri(), [0, 0, 0], [1, 1, 1]);
    store.world.objects.push(dense, mine);
    commands.space.follow([dense.id, mine.id]);
    await session.host("Test", "private");
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "p1");
    deliver("xf", { objs: [{ id: mine.id, pos: [40, 0, 0], quat: mine.quat, size: mine.size }] }, "p1");
    expect(store.byId(mine.id)!.pos[0]).toBe(40);
    deliver("objs", { set: [{ ...structuredClone(mine), pos: [40, 0, 0] }], del: [], order: [], ver: 0 }, "p1");
    expect(store.byId(mine.id)!.pos[0]).toBe(0);
  });
  it("only the authority judges the laws of space: elsewhere a builder's edit is taken, and its verdict follows", async () => {
    const { store, session, commands } = setup();
    const dense = newObj(store.world, tri(), [40, 0, 0], [1, 1, 1]);
    for (let i = 0; i < 50_000; i++) {
      dense.mesh.v.push([i / 50_000, 1, 0]);
      dense.mesh.f.push([0, 1, dense.mesh.v.length - 1]);
      dense.mesh.fm.push(0);
    }
    const box = newObj(store.world, tri(), [0, 0, 0], [1, 1, 1]);
    store.world.objects.push(dense, box);
    commands.space.follow([dense.id, box.id]);
    await session.host("Test", "private");
    ownerAway(session);
    for (const pid of ["a0", "p1"]) {
      wire.hooks!.onPeerJoin(pid);
      deliver("hello", { name: pid, look: {}, synced: true, ver: 1 }, pid);
    }
    // the smallest id runs a private room
    expect(session.authorityId()).toBe("a0");
    deliver("objs", { set: [{ ...structuredClone(box), pos: [40, 0, 0] }], del: [], order: [], ver: 0 }, "p1");
    expect(store.byId(box.id)!.pos[0]).toBe(40);
    // the authority refused it and sends its copy: that is what stands
    deliver("objs", { set: [{ ...structuredClone(box), pos: [0, 0, 0] }], del: [], order: [], ver: 0 }, "a0");
    expect(store.byId(box.id)!.pos[0]).toBe(0);
  });
  it("someone who leaves in the middle of a drag leaves the object where the drag started", async () => {
    const { store, session } = setup();
    const box = newObj(store.world, tri(), [1, 1, 1], [1, 1, 1]);
    store.world.objects.push(box);
    await session.host("Test", "private");
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "p1");
    deliver("xf", { objs: [{ id: box.id, pos: [9, 1, 1], quat: box.quat, size: box.size }] }, "p1");
    expect(store.byId(box.id)!.pos[0]).toBe(9);
    wire.hooks!.onPeerLeave("p1");
    expect(store.byId(box.id)!.pos[0]).toBe(1);
  });
  it("only the authority puts an abandoned drag back, for everyone", async () => {
    vi.useFakeTimers();
    const { store, session } = setup();
    const box = newObj(store.world, tri(), [1, 1, 1], [1, 1, 1]);
    store.world.objects.push(box);
    await session.host("Test", "private");
    for (const pid of ["a0", "p1"]) {
      wire.hooks!.onPeerJoin(pid);
      deliver("hello", { name: pid, look: {}, synced: true, ver: 1 }, pid);
    }
    deliver("xf", { objs: [{ id: box.id, pos: [9, 1, 1], quat: box.quat, size: box.size }] }, "p1");
    wire.sent.length = 0;
    wire.hooks!.onPeerLeave("p1");
    vi.advanceTimersByTime(100);
    expect(store.byId(box.id)!.pos[0]).toBe(1);
    expect(wire.sent.find((m) => m.name === "objs")?.data.set[0].pos[0]).toBe(1);
    // the owner away, a0 runs the room: p2's abandoned drag is a0's to put back, not ours
    ownerAway(session);
    wire.hooks!.onPeerJoin("p2");
    deliver("hello", { name: "p2", look: {}, synced: true, ver: 1 }, "p2");
    deliver("xf", { objs: [{ id: box.id, pos: [5, 1, 1], quat: box.quat, size: box.size }] }, "p2");
    wire.hooks!.onPeerLeave("p2");
    expect(store.byId(box.id)!.pos[0]).toBe(5);
  });

  it("someone removed in the middle of a drag leaves the object where the drag started too", async () => {
    const { store, session } = setup();
    const box = newObj(store.world, tri(), [1, 1, 1], [1, 1, 1]);
    store.world.objects.push(box);
    await session.host("Test", "private");
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "p1");
    deliver("xf", { objs: [{ id: box.id, pos: [9, 1, 1], quat: box.quat, size: box.size }] }, "p1");
    await session.kick("p1");
    expect(store.byId(box.id)!.pos[0]).toBe(1);
  });
  it("someone who may not build never runs the room while a builder is here, and their 'verdicts' are nobody's", async () => {
    const { store, session } = setup();
    const box = newObj(store.world, tri(), [1, 1, 1], [1, 1, 1]);
    store.world.objects.push(box);
    await session.host("Test", "private");
    await session.setEveryoneBuilds(false);
    wire.hooks!.onPeerJoin("a0");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "a0");
    expect(session.canBuild("a0")).toBe(false);
    // a0 has the smallest id, but may not build: the owner runs the room
    expect(session.authorityId()).toBe("me");
    const forged = { ...structuredClone(box), pos: [7, 1, 1] };
    deliver("objs", { set: [forged], del: [], order: [], ver: 0, verdict: { to: "me", why: "dense" } }, "a0");
    expect(store.byId(box.id)!.pos[0]).toBe(1);
  });

  it("the authority's verdict stands on every screen, and the person whose edit it was hears why", async () => {
    const { store, session, bus } = setup();
    const box = newObj(store.world, tri(), [1, 1, 1], [1, 1, 1]);
    store.world.objects.push(box);
    await session.host("Test", "private");
    ownerAway(session);
    wire.hooks!.onPeerJoin("a0");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "a0");
    expect(session.authorityId()).toBe("a0");
    const heard: string[] = [];
    bus.on("space:refused", ({ text }) => heard.push(text));
    const back = { ...structuredClone(box), pos: [7, 1, 1] };
    deliver("objs", { set: [back], del: [], order: [], ver: 0, verdict: { to: "me", why: "dense" } }, "a0");
    expect(store.byId(box.id)!.pos[0]).toBe(7);
    expect(heard[0]).toMatch(/Too dense/);
    // what the authority put back is its change, for the owner to see and undo
    expect(session.changers()).toMatchObject([{ name: "Ann", objects: 1 }]);
    expect(session.undoPerson(session.changers()[0].who)).toBe(1);
    expect(store.byId(box.id)!.pos[0]).toBe(1);
  });

  it("the owner runs the room whenever they are here, however small the others' ids", async () => {
    const { session } = setup();
    await session.host("Test", "private");
    wire.hooks!.onPeerJoin("a0");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 1 }, "a0");
    expect(session.canBuild("a0")).toBe(true);
    expect(session.authorityId()).toBe("me");
    ownerAway(session);
    expect(session.authorityId()).toBe("a0");
  });

  it("script edits come from the authority only, and only move scripted objects", async () => {
    const { store, session } = setup();
    const plain = newObj(store.world, tri(), [1, 1, 1], [1, 1, 1]);
    const lift = { ...newObj(store.world, tri(), [2, 1, 1], [1, 1, 1]), script: "on touch: move up 1" };
    store.world.objects.push(plain, lift);
    await session.host("Test", "private");
    ownerAway(session);
    for (const pid of ["a0", "p9"]) {
      wire.hooks!.onPeerJoin(pid);
      deliver("hello", { name: pid, look: {}, synced: true, ver: 1 }, pid);
    }
    const moved = (o: typeof plain) => ({ ...structuredClone(o), pos: [8, 1, 1] });
    deliver("objs", { set: [moved(lift)], del: [], order: [], ver: 0, s: 1 }, "p9");
    expect(store.byId(lift.id)!.pos[0]).toBe(2);
    deliver("objs", { set: [moved(plain)], del: [], order: [], ver: 0, s: 1 }, "a0");
    expect(store.byId(plain.id)!.pos[0]).toBe(1);
    deliver("objs", { set: [moved(lift)], del: [], order: [], ver: 0, s: 1 }, "a0");
    expect(store.byId(lift.id)!.pos[0]).toBe(8);
    expect(session.changers()).toEqual([]);
  });

  it("a newcomer takes the scene from the authority only, and asks again when someone else sends one", async () => {
    const { store, session } = setup();
    const id = await session.host("Test", "private");
    await session.leave();
    await session.join(id);
    wire.hooks!.onPeerJoin("p1");
    deliver("hello", { name: "Ann", look: {}, synced: true, ver: 7, fresh: false }, "p1");
    expect(session.net.synced).toBe(false);
    const fake = newObj({ seq: 90, objects: [] }, tri(), [0, 0, 0], [1, 1, 1]);
    wire.sent.length = 0;
    await deliver("snap", { world: { seq: 1, objects: [fake] }, ver: 9 }, "p2");
    expect(session.net.synced).toBe(false);
    expect(wire.sent.at(-1)).toMatchObject({ name: "hello" });
    await deliver("snap", { world: { seq: 1, objects: [] }, ver: 9 }, "p1");
    expect(session.net.synced).toBe(true);
    expect(store.byId(fake.id)).toBeUndefined();
  });
});
