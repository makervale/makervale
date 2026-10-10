/** What an avatar looks like: the built-in figure's colours and proportions, or a VRM model. */
import { validModel } from "./vrm/registry";

export type HairStyle = "short" | "long" | "bun" | "curly" | "none";

export interface Look {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  shirt: string;
  pants: string;
  shoes: string;
  /** 0 slim … 1 broad */
  build: number;
  /** a scale on the figure's height, 0.9 … 1.1 */
  height: number;
  /** "" for the built-in figure, otherwise a model name (see vrm/registry.ts) */
  model: string;
}

export const SKINS = ["#f3d2b8", "#e2b393", "#c99068", "#9a6644", "#6a4129"];
export const HAIRS: HairStyle[] = ["short", "long", "bun", "curly", "none"];

export const DEFAULT_LOOK: Look = {
  skin: "#e2b393",
  hair: "short",
  hairColor: "#4a3426",
  shirt: "#3d6fa8",
  pants: "#3a3f4a",
  shoes: "#26282b",
  build: 0.5,
  height: 1,
  model: "",
};

const HEIGHT_RANGE: [number, number] = [0.9, 1.1];

const hex = (x: unknown, fallback: string): string =>
  typeof x === "string" && /^#[0-9a-f]{6}$/i.test(x) ? x : fallback;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const isHair = (x: unknown): x is HairStyle => HAIRS.includes(x as HairStyle);

/** a look that arrived from somewhere else (a peer, storage), made safe */
export function cleanLook(input: unknown): Look {
  const d = DEFAULT_LOOK;
  if (!input || typeof input !== "object") return { ...d };
  const x = input as Record<string, unknown>;
  return {
    skin: hex(x.skin, d.skin),
    hair: isHair(x.hair) ? x.hair : d.hair,
    hairColor: hex(x.hairColor, d.hairColor),
    shirt: hex(x.shirt, d.shirt),
    pants: hex(x.pants, d.pants),
    shoes: hex(x.shoes, d.shoes),
    build: clamp(Number(x.build) || 0, 0, 1),
    height: clamp(Number(x.height) || 1, ...HEIGHT_RANGE),
    model: validModel(x.model) ? x.model : "",
  };
}
