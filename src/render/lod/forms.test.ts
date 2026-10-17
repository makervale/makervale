import { describe, expect, it } from "vitest";
import { nextForm } from "./forms";

describe("nextForm", () => {
  it("goes finer at once, coarser only past the margin and after a pause", () => {
    expect(nextForm("box", "simple", "simple", 0)).toBe("simple");
    expect(nextForm("full", "simple", "full", 5)).toBe("full");
    expect(nextForm("full", "simple", "simple", 0.1)).toBe("full");
    expect(nextForm("full", "box", "simple", 5)).toBe("simple");
  });
});
