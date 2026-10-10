import { describe, expect, it } from "vitest";
import { mergeInput, NO_TOUCH } from "./touch-input";

const keys = { fwd: 0, lr: 0, up: false, down: false, shift: false };

describe("mergeInput", () => {
  it("passes the joystick through when no key is held", () => {
    expect(mergeInput(keys, { fwd: 0.5, lr: -0.25, climb: 1 })).toEqual({ ...keys, fwd: 0.5, lr: -0.25, up: true });
  });

  it("keeps keys and joystick within one full push", () => {
    expect(mergeInput({ ...keys, fwd: 1 }, { ...NO_TOUCH, fwd: 0.8 }).fwd).toBe(1);
  });

  it("climbs down with the down button", () => {
    expect(mergeInput(keys, { ...NO_TOUCH, climb: -1 }).down).toBe(true);
  });
});
