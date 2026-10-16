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
});
