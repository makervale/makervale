import { describe, expect, it } from "vitest";
import { stripControl } from "./text";

describe("stripControl", () => {
  it("removes control characters", () => {
    expect(stripControl("a\u0000b\nc\td\u001f")).toBe("abcd");
  });

  it("keeps tabs and newlines when asked", () => {
    expect(stripControl("a\u0000b\nc\td\r", true)).toBe("ab\nc\td");
  });
});
