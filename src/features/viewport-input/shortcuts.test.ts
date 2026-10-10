import { describe, expect, it } from "vitest";
import { comboOf, TOOL_KEYS } from "./shortcuts";

describe("shortcut combos", () => {
  it("keeps Shift only where it picks another tool", () => {
    expect(comboOf("h", false, true)).toBe("shift+h");
    expect(comboOf("e", false, true)).toBe("e");
    expect(comboOf("g", true, true)).toBe("ctrl+shift+g");
    expect(comboOf("d", true, false)).toBe("ctrl+d");
  });
  it("maps the classic keys to tools", () => {
    expect(TOOL_KEYS[comboOf("b", false, true)]).toBe("bridge");
    expect(TOOL_KEYS[comboOf("r", true, false)]).toBe("loopcut");
  });
});
