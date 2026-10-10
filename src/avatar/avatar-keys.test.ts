import { describe, expect, it } from "vitest";
import { AvatarKeys } from "./avatar-keys";

const key = (code: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

function setup(editing = false, selected = false) {
  let t = 100_000;
  const keys = new AvatarKeys({ editingMesh: () => editing, somethingSelected: () => selected }, () => t);
  return { keys, advance: (ms: number) => (t += ms) };
}

describe("avatar keys", () => {
  it("walks with WASD and arrows, runs with Shift", () => {
    const { keys } = setup();
    keys.press(key("KeyW"), false, false);
    keys.press(key("ArrowLeft"), false, false);
    expect(keys.input(true)).toEqual({ fwd: 1, lr: -1, up: false, down: false, shift: true });
  });
  it("leaves E and F to the editor when they mean something there", () => {
    const { keys } = setup(true, true);
    expect(keys.press(key("KeyE"), false, false)).toBeNull();
    expect(keys.press(key("KeyF"), false, false)).toBeNull();
    expect(keys.press(key("Home"), false, false)).toBe("toggleFly");
  });
  it("ignores shortcuts with Ctrl, Alt or Cmd", () => {
    const { keys } = setup();
    expect(keys.press(key("KeyS", { ctrlKey: true }), false, false)).toBeNull();
  });
  it("takes off on a double tap of jump", () => {
    const { keys, advance } = setup();
    expect(keys.press(key("Space"), false, false)).toBe("none");
    keys.release("Space");
    advance(200);
    expect(keys.press(key("Space"), false, false)).toBe("fly");
  });
  it("stands up seated only on a second push forward", () => {
    const { keys, advance } = setup();
    keys.seated();
    expect(keys.press(key("KeyW"), true, false)).toBe("sittingHint");
    keys.release("KeyW");
    advance(500);
    expect(keys.press(key("KeyW"), true, false)).toBe("stand");
    expect(keys.press(key("KeyF"), true, false)).toBe("toggleFly");
  });
  it("does nothing on key repeat", () => {
    const { keys } = setup();
    keys.press(key("Home"), false, false);
    expect(keys.press(key("Home"), false, false)).toBe("none");
  });
});
