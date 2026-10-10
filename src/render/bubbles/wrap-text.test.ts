import { describe, expect, it } from "vitest";
import { MAX_LINES, wrapText } from "./wrap-text";

const measure = (s: string) => s.length;

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("hello there", 20, measure)).toEqual(["hello there"]);
  });
  it("wraps at word boundaries", () => {
    expect(wrapText("one two three four", 9, measure)).toEqual(["one two", "three", "four"]);
  });
  it("stops at the line limit and marks the cut", () => {
    const lines = wrapText("a b c d e f g h i j k l", 1, measure);
    expect(lines).toHaveLength(MAX_LINES);
    expect(lines[MAX_LINES - 1].endsWith("…")).toBe(true);
  });
  it("breaks a word too long for a line", () => {
    expect(wrapText("see https://example.org/a/long/path", 12, measure)).toEqual([
      "see",
      "https://exam",
      "ple.org/a/lo",
      "ng/path",
    ]);
  });
});
