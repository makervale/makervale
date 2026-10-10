import { describe, expect, it } from "vitest";
import type { ParamDef } from "@/app/tools";
import { ctrlStep, sensitivity } from "./env";

const def = (unit: string | undefined): ParamDef => ({ key: "k", label: "K", min: 0, max: 50, step: 1, def: 1, unit });

describe("live tool mouse scales", () => {
  it("moves metres with the cursor, percent and degrees at fixed rates", () => {
    expect(sensitivity(def("m"), 0.02)).toBe(0.02);
    expect(sensitivity(def("%"), 0.02)).toBe(0.25);
    expect(sensitivity(def("°"), 0.02)).toBe(0.5);
    expect(sensitivity(def(undefined), 0.02)).toBe(0.1);
  });
  it("snaps with Ctrl to ruler steps, 5° / 5 %, or five steps", () => {
    expect(ctrlStep(def("m"), () => 0.25)).toBe(0.25);
    expect(ctrlStep(def("°"), () => 0.25)).toBe(5);
    expect(ctrlStep(def(undefined), () => 0.25)).toBe(5);
  });
});
