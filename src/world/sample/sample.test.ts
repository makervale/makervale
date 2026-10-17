import { describe, expect, it } from "vitest";
import { signedVolume } from "@/lib/mesh/mesh";
import { parse } from "@/lib/lua";
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

  it("has a script on every game piece, and every script parses", () => {
    const scripted = new Set(w.objects.filter((o) => o.script).map((o) => o.name));
    for (const name of ["Guide", "Hall of Fame", "Start pad", "Finish", "Simon", "Bell 1", "Bell 6", "Treasure chest"]) {
      expect(scripted, name).toContain(name);
    }
    for (const name of ["Chest lid", "Gem 1", "Gem 5", "Ball", "Scoreboard", "North goal area", "South goal area", "Lantern"]) {
      expect(scripted, name).toContain(name);
    }
    for (const o of w.objects) if (o.script) expect(() => parse(o.script!), o.name).not.toThrow();
  });

  it("has a ball that physics moves, resting on the pitch", () => {
    const ball = w.objects.find((o) => o.name === "Ball")!;
    expect(ball.body).toEqual({ shape: "ball", bounce: 0.6 });
    expect(ball.pos[2]).toBeGreaterThan(Math.max(...ball.size) / 2 - 0.01);
    expect(ball.pos[2]).toBeLessThan(Math.max(...ball.size) / 2 + 0.05);
  });

  it("numbers objects and groups from one counter", () => {
    expect(w.objects[0].id).toBe("o1");
    expect(w.objects.some((o) => o.group)).toBe(true);
    expect(new Set(w.objects.map((o) => o.id)).size).toBe(w.objects.length);
    expect(w.seq).toBeGreaterThan(w.objects.length);
  });
});
