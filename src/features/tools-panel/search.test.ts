import { describe, expect, it } from "vitest";
import type { ToolDef } from "@/app/tools";
import { score, searchTools, tokenWeight } from "./search";

const tool = (id: string, name: string, synonyms: string[], summary = "", key?: string): ToolDef => ({
  id,
  name,
  category: "edit",
  summary,
  steps: [],
  synonyms,
  key,
  need: "none",
  run: () => {},
});

const TOOLS = [
  tool("extrude", "Extrude", ["pull out", "push", "raise"], "Pulls faces out", "E"),
  tool("bevel", "Bevel", ["round off", "chamfer", "fillet"], "Rounds edges", "B"),
  tool("hole", "Boolean", ["hole", "cut out", "subtract"], "Cuts one object with another"),
  tool("inset", "Inset", ["frame", "border"], "Makes a smaller face inside", "I"),
];
const cat = () => "Edit";

describe("tool search", () => {
  it("weighs word starts above matches inside words", () => {
    expect(tokenWeight("round off", "round")).toBe(2);
    expect(tokenWeight("pull-out", "out")).toBe(2);
    expect(tokenWeight("subtract", "tract")).toBe(1);
  });

  it("matches by stem for longer words", () => {
    expect(tokenWeight("rounds edges", "rounding")).toBe(0.8);
    expect(tokenWeight("pull", "pul")).toBe(2);
    expect(tokenWeight("rounds", "rnd")).toBe(0);
    expect(tokenWeight("rounds", "abc")).toBe(0);
  });

  it("ignores filler words and needs every real word to match", () => {
    expect(score(TOOLS[1], "how do I round off")).toBeGreaterThan(0);
    expect(score(TOOLS[1], "round banana")).toBe(0);
    expect(score(TOOLS[0], "")).toBe(1);
    expect(score(TOOLS[0], "the a")).toBe(0);
  });

  it("puts the name above synonyms above the summary", () => {
    expect(score(TOOLS[0], "extrude")).toBe(12);
    expect(score(TOOLS[2], "hole")).toBe(6);
    expect(score(TOOLS[3], "smaller")).toBe(2);
  });

  it("finds tools by what you want to do, best first", () => {
    expect(searchTools(TOOLS, "make a hole", cat).map((t) => t.id)).toEqual(["hole"]);
    expect(searchTools(TOOLS, "round", cat)[0].id).toBe("bevel");
    expect(searchTools(TOOLS, "Śfrłame", cat)).toEqual([]);
  });

  it("ignores Polish diacritics and case", () => {
    expect(score(tool("x", "Wyciągnij", []), "WYCIAGNIJ")).toBeGreaterThan(0);
  });
});
