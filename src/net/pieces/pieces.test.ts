import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRules } from "@/lib/rules";
import { newObj } from "@/world/model";
import type { World } from "@/world/model";
import { bucketObjects } from "./pack";

// against the project's own test relay, as a real browser would use it
const PORT = 7861;
(globalThis as any).location = { search: `?relays=ws://127.0.0.1:${PORT}` };
let relay: ChildProcess;

beforeAll(async () => {
  relay = spawn(process.execPath, ["test/relay.mjs", String(PORT)], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise<void>((res) => relay.stdout!.once("data", () => res()));
});
afterAll(() => {
  relay.kill();
});

const { roomKeys } = await import("../room-keys");
const { writeVault } = await import("../vault/write");
const { readVault } = await import("../vault/read");
const { forgetVault } = await import("../vault/forget");
const { publishWorld, unpublishWorld } = await import("../gallery/publish");
const { browseGallery, loadVersion } = await import("../gallery/catalog");

const tri = (k: number) => ({
  v: [
    [0, 0, 0],
    [k, 0, 0],
    [0, k, 0],
  ] as [number, number, number][],
  f: [[0, 1, 2]],
  fm: [0],
});

function scene(n: number): World {
  const w: World = { seq: 1, objects: [] };
  for (let i = 0; i < n; i++) w.objects.push(newObj(w, tri(i + 1), [i, 0, 0], [1, 1, 1]));
  return w;
}

const store = new Map<string, string>();
const rulesApi = createRules({ get: (k) => store.get(k) ?? null, set: (k, v) => void store.set(k, v) });

describe("pieces", () => {
  it("cut by id, so one changed object changes one bucket", () => {
    const w = scene(60);
    const before = bucketObjects(w.objects).map((b) => b.map((o) => o.id).join());
    w.objects[17] = { ...w.objects[17], pos: [9, 9, 9] };
    expect(bucketObjects(w.objects).map((b) => b.map((o) => o.id).join())).toEqual(before);
  });
});

describe("Keep online", () => {
  it("saves a private room's copy, opens it with the code alone, and forgets it", async () => {
    const keys = await roomKeys("testroomcode");
    const rules = (await rulesApi.updateRules(await rulesApi.newRules("testroomcode", "p", "private"), {
      keep: true,
    }))!;
    const world = scene(30);
    expect(await writeVault(keys, { world, name: "Kept", ver: 3, rules, ownerSecret: null })).toBeGreaterThan(0);
    const copy = await readVault(keys, null);
    expect(copy?.manifest.name).toBe("Kept");
    expect(copy?.world.objects.map((o) => o.id)).toEqual(world.objects.map((o) => o.id));
    expect(await readVault(await roomKeys("anothercode1"), null)).toBeNull();
    await forgetVault(keys, [keys.secret], []);
    expect(await readVault(keys, null)).toBeNull();
  }, 60_000);
});

describe("the Gallery", () => {
  it("publishes versions anyone can view, each exactly as it was, and unpublishes", async () => {
    const one = scene(5);
    const v1 = (await publishWorld({ world: one, title: "Tiny", about: "", note: "", by: "Ann", basedOn: "" }, null))!;
    const two = scene(9);
    const v2 = (await publishWorld(
      { world: two, title: "Tiny", about: "", note: "more", by: "Ann", basedOn: "" },
      v1,
    ))!;
    expect(v2.versions.map((x) => x.v)).toEqual([1, 2]);
    const listed = (await browseGallery()).find((h) => h.id === v1.id)!;
    expect(listed.versions.length).toBe(2);
    expect((await loadVersion(listed, 1))?.objects.length).toBe(5);
    expect((await loadVersion(listed, 2))?.objects.length).toBe(9);
    await unpublishWorld(listed);
    expect((await browseGallery()).find((h) => h.id === v1.id)).toBeUndefined();
  }, 60_000);
});
