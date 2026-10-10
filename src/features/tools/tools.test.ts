import { describe, expect, it } from "vitest";
import { demoContext } from "@/app/tool-runner";
import { ToolRegistry, defaultParams } from "@/app/tools";
import { signedVolume } from "@/lib/mesh/mesh";
import { emptySelection } from "@/lib/mesh/selection";
import { inspect } from "@/lib/mesh/validate";
import { CATEGORIES, registerTools, standaloneToolApp } from "./index";
import type { CatalogTool } from "./index";

const registry = new ToolRegistry();
registerTools(registry);
const TOOLS = registry.all() as CatalogTool[];

describe("tool registry", () => {
  it("has cards in every category", () => {
    for (const c of CATEGORIES)
      expect(
        TOOLS.some((t) => t.category === c.id),
        c.id,
      ).toBe(true);
  });

  it("every card is fully described", () => {
    for (const t of TOOLS) {
      expect(t.summary.length, t.id).toBeGreaterThan(20);
      expect(t.steps.length, t.id).toBeGreaterThan(0);
      expect(t.synonyms.length, t.id).toBeGreaterThan(0);
      expect(
        CATEGORIES.some((c) => c.id === t.category),
        t.id,
      ).toBe(true);
      for (const r of t.related ?? []) expect(registry.get(r), `${t.id} → ${r}`).toBeDefined();
    }
  });

  it("keeps the old ids, in the old order", () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.join(" ")).toBe(
      [
        "box plane cylinder cone sphere icosphere torus tube stairs",
        "selall invert grow shrink linked loop ring boundary bymat boxsel",
        "move rotate scale flatten smooth inflate circle opt-snap opt-mirror opt-soft",
        "extrude inset delfaces fill split dupfaces flip recalc triangulate quads",
        "loopcut dissolve deledges merge connect delverts subdivide mirror weld",
        "duplicate delete join group ungroup ground origin applysize hide unhide lock focus",
        "newmat assignmat check export bevel knife bridge edgeext bisect solidify spin array arrayr",
        "decimate cleanup detach spike boolean import exportstl exportobj uvsmart uvbox uvcyl uvclear",
        "selsharp selflat selsimilar",
        "ball trampoline",
      ].join(" "),
    );
    expect(TOOLS.filter((t) => t.pie).map((t) => t.id)).toEqual([
      ...["loop", "extrude", "inset", "delfaces", "split", "loopcut", "merge", "connect", "duplicate"],
      ...["delete", "newmat", "bevel", "knife"],
    ]);
  });

  const runnable = TOOLS.filter(
    (t) => t.demo && (!t.kind || t.kind === "op" || t.kind === "create" || t.kind === "select"),
  );
  for (const t of runnable) {
    it(`demo of "${t.name}" runs and leaves a sane mesh`, () => {
      const demo = t.demo!;
      const m = demo.mesh();
      const wasClosed = inspect(m).closed;
      const s = demo.selection ? demo.selection(m) : emptySelection();
      const ctx = demoContext(m, s, demo.mode ?? "object");
      const params = defaultParams(t, demo.params);
      if (t.demoRun) t.demoRun(ctx, params);
      else t.run(ctx, params);
      const out = t.kind === "create" ? ctx.world.objects[ctx.world.objects.length - 1].mesh : m;
      const rep = inspect(out);
      if (t.id !== "flip") expect(rep.flipped.length, "flipped").toBe(0);
      expect(rep.nonManifold.length, "non-manifold").toBe(0);
      if (wasClosed && !["delfaces", "deledges", "delverts", "split", "flip", "detach"].includes(t.id)) {
        expect(rep.open.length, "open").toBe(0);
        expect(signedVolume(out)).toBeGreaterThan(0);
      }
      if (t.id === "weld") expect(rep.closed).toBe(true);
    });
  }
});

describe("tools that reach into the app", () => {
  it("options toggle settings and say so", () => {
    const app = standaloneToolApp();
    const r = new ToolRegistry();
    registerTools(r, app);
    const snap = r.get("opt-snap")!;
    expect(snap.isOn?.()).toBe(true);
    expect(snap.run(demoContext({ v: [], f: [], fm: [] }, emptySelection(), "object"), {})).toBe("Snap to ruler: off");
    expect(app.store.settings.snap).toBe(false);
    r.get("opt-soft")!.run(demoContext({ v: [], f: [], fm: [] }, emptySelection(), "object"), {});
    expect(app.store.settings.softRadiusMetres).toBe(0.5);
  });

  it("manipulator cards pick the manipulator and commands go over the bus", () => {
    const app = standaloneToolApp();
    const r = new ToolRegistry();
    registerTools(r, app);
    const sent: string[] = [];
    app.bus.on("menu:command", ({ command }) => sent.push(command));
    const ctx = demoContext({ v: [], f: [], fm: [] }, emptySelection(), "object");
    r.get("rotate")!.run(ctx, {});
    expect(app.store.manipulator).toBe("rotate");
    for (const id of ["check", "export", "import", "exportstl", "exportobj", "focus"]) r.get(id)!.run(ctx, {});
    expect(sent).toEqual(["report", "export", "import", "export-stl", "export-obj", "focus"]);
  });
});
