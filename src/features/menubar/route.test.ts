import { describe, expect, it } from "vitest";
import { route } from "./route";

describe("menu command routing", () => {
  it("sends tools, windows and the sky where they belong", () => {
    expect(route("tool:selall")).toEqual({ kind: "tool", id: "selall" });
    expect(route("win:camfl")).toEqual({ kind: "window", id: "camfl" });
    expect(route("time:night")).toEqual({ kind: "sky", mode: "night" });
  });

  it("hands file and panel commands to their features", () => {
    for (const c of ["new", "open", "save", "export", "sample", "catalog"]) {
      expect(route(c)).toEqual({ kind: "feature", command: c });
    }
  });

  it("keeps undo, selection and camera commands", () => {
    expect(route("undo")).toEqual({ kind: "local", name: "undo" });
    expect(route("wire")).toEqual({ kind: "local", name: "wire" });
    expect(route("about")).toEqual({ kind: "local", name: "about" });
  });

  it("ignores what it doesn't know", () => {
    expect(route("time:dusk")).toEqual({ kind: "unknown" });
    expect(route("toString")).toEqual({ kind: "unknown" });
  });
});
