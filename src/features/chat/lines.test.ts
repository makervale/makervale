import { describe, expect, it } from "vitest";
import type { ChatLine } from "@/net/state";
import { FADE_AFTER_MS, isOld, lineKind, unseenLines } from "./lines";

const line = (text: string, extra: Partial<ChatLine> = {}): ChatLine => ({
  from: "p",
  name: "Ann",
  text,
  at: 0,
  ...extra,
});

describe("chat lines", () => {
  it("classifies system, own, object and other lines", () => {
    expect(lineKind(line("a", { system: true }))).toBe("sys");
    expect(lineKind(line("a", { self: true }))).toBe("me");
    expect(lineKind(line("a", { obj: true }))).toBe("obj");
    expect(lineKind(line("a"))).toBe("them");
  });

  it("returns everything the first time, then only what came after the last shown line", () => {
    const a = line("a");
    const b = line("b");
    const chat = [a, b];
    expect(unseenLines(chat, null).lines).toEqual([a, b]);
    const c = line("c");
    chat.push(c);
    expect(unseenLines(chat, b)).toEqual({ reset: false, lines: [c] });
    expect(unseenLines(chat, c).lines).toEqual([]);
  });

  it("keeps finding new lines when a full chat drops its oldest", () => {
    const chat = [line("a"), line("b")];
    const last = chat[1];
    chat.shift();
    const n = line("n");
    chat.push(n);
    expect(unseenLines(chat, last)).toEqual({ reset: false, lines: [n] });
  });

  it("starts over when the chat was cleared (left a room)", () => {
    const gone = line("old");
    const fresh = [line("new")];
    expect(unseenLines(fresh, gone)).toEqual({ reset: true, lines: fresh });
    expect(unseenLines([], gone).reset).toBe(true);
  });

  it("fades lines after half a minute", () => {
    expect(isOld(0, FADE_AFTER_MS)).toBe(false);
    expect(isOld(0, FADE_AFTER_MS + 1)).toBe(true);
  });
});
