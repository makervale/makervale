import { describe, expect, it } from "vitest";
import { signedVolume } from "@/lib/mesh/mesh";
import { parse } from "@/lib/script";
import { inspect } from "@/lib/mesh/validate";
import { sampleWorld } from "./index";

describe("showcase scene", () => {
  const t0 = Date.now();
  const w = sampleWorld();
  const ms = Date.now() - t0;

  it("builds clean, closed meshes", () => {
    let tris = 0;
    const bad: string[] = [];
    for (const o of w.objects) {
      const r = inspect(o.mesh);
      tris += r.tris;
      const vol = signedVolume(o.mesh);
      if (r.nonManifold.length || r.flipped.length || r.open.length || vol <= 0) {
        bad.push(
          `${o.name}: open ${r.open.length}, nm ${r.nonManifold.length}, flipped ${r.flipped.length}, vol ${vol.toFixed(4)}`,
        );
      }
      for (const s of o.mesh.fm) expect(s, o.name).toBeLessThan(o.materials.length);
      for (const v of o.mesh.v) for (const x of v) expect(Math.abs(x), o.name).toBeLessThanOrEqual(0.5 + 1e-6);
    }
    console.log(`${w.objects.length} objects, ${tris} triangles, built in ${ms} ms`);
    expect(bad).toEqual([]);
  });

  it("has working scripts on the interactive pieces", () => {
    const scripted = w.objects.filter((o) => o.script).map((o) => o.name);
    expect(scripted).toEqual([
      ...["Finial", "Geode", "Fountain basin", "Bloom", "Twist", "Lantern", "Lantern", "Lantern", "Lantern"],
      ...["Gate", "Lift", "Door"],
      ...["North goal area", "South goal area", "Ball"],
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => "Chime " + i),
    ]);
    for (const o of w.objects) if (o.script) expect(() => parse(o.script!), o.name).not.toThrow();
  });

  it("has a ball that physics moves, resting on the pitch", () => {
    const ball = w.objects.find((o) => o.name === "Ball")!;
    expect(ball.body).toEqual({ shape: "ball", bounce: 0.6 });
    expect(ball.pos[2]).toBeGreaterThan(Math.max(...ball.size) / 2 - 0.01);
  });

  it("numbers objects and groups from one counter, as the old scene did", () => {
    expect(w.objects[0].id).toBe("o1");
    expect(w.objects[1].group).toBe("g2");
    expect(new Set(w.objects.map((o) => o.id)).size).toBe(w.objects.length);
    expect(w.seq).toBeGreaterThan(w.objects.length);
  });
});
