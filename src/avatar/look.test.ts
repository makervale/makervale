import { describe, expect, it } from "vitest";
import { cleanLook, DEFAULT_LOOK } from "./look";
import { AVATARS } from "./vrm/registry";

describe("cleanLook", () => {
  it("falls back to the default for anything that is not an object", () => {
    expect(cleanLook(null)).toEqual(DEFAULT_LOOK);
    expect(cleanLook("hello")).toEqual(DEFAULT_LOOK);
  });

  it("keeps valid fields and repairs the rest", () => {
    const look = cleanLook({ skin: "#112233", hair: "mohawk", shirt: "red", build: 7, height: 2, model: "evil" });
    expect(look.skin).toBe("#112233");
    expect(look.hair).toBe(DEFAULT_LOOK.hair);
    expect(look.shirt).toBe(DEFAULT_LOOK.shirt);
    expect(look.build).toBe(1);
    expect(look.height).toBe(1.1);
    expect(look.model).toBe("");
  });

  it("accepts index models and loaded files, nothing else", () => {
    expect(cleanLook({ model: AVATARS[0].model }).model).toBe(AVATARS[0].model);
    const file = "file:" + "a".repeat(64);
    expect(cleanLook({ model: file }).model).toBe(file);
    expect(cleanLook({ model: "https://example.com/x.vrm" }).model).toBe("");
  });
});
