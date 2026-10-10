/** The start scene's materials. */
import type { Material } from "@/world/model";

export type Mat = Partial<Material>;

export const STONE: Mat = { name: "Stone", color: "#d6cdb9", pattern: "stone", repU: 0.5, repV: 0.5, roughness: 0.9 };
export const MARBLE: Mat = { name: "Marble", color: "#efeae2", roughness: 0.35 };
export const TILES: Mat = {
  name: "Floor tiles",
  color: "#ddd3c1",
  pattern: "tile",
  repU: 0.5,
  repV: 0.5,
  roughness: 0.6,
};
export const COPPER: Mat = {
  name: "Copper patina",
  color: "#5b9a88",
  pattern: "brick",
  repU: 10,
  repV: 1.6,
  roughness: 0.45,
  metalness: 0.35,
};
export const GOLD: Mat = { name: "Gold", color: "#d8a640", roughness: 0.25, metalness: 0.85, emissive: 0.12 };
export const WATER: Mat = { name: "Water", color: "#3f9fca", roughness: 0.05, metalness: 0.1, opacity: 0.72 };
export const WOOD: Mat = { name: "Wood", color: "#9a6a3d", pattern: "plank", repU: 1.5, repV: 1.5, roughness: 0.7 };
export const IRON: Mat = { name: "Iron", color: "#3b3f44", roughness: 0.45, metalness: 0.6 };
export const BRICK: Mat = { name: "Brick", color: "#b9806a", pattern: "brick", repU: 1, repV: 1, roughness: 0.85 };
export const ROOF: Mat = {
  name: "Roof tiles",
  color: "#a5503c",
  pattern: "brick",
  repU: 1.6,
  repV: 1.6,
  rot: 90,
  roughness: 0.75,
};
export const GLASS: Mat = { name: "Glass", color: "#bfe3f2", roughness: 0.05, metalness: 0.2, opacity: 0.35 };
export const TERRA: Mat = { name: "Terracotta", color: "#c4704f", roughness: 0.6 };
export const LIGHT: Mat = { name: "Lamp glow", color: "#ffd27a", roughness: 0.3, emissive: 1.4 };
export const BARK: Mat = { name: "Bark", color: "#6b4a32", pattern: "concrete", repU: 1, repV: 1, roughness: 0.95 };
export const LEAVES = ["#5f8f4e", "#4f7f45", "#6d9a52", "#577f3f"];
export const ROCK: Mat = { name: "Rock", color: "#8d8a83", pattern: "concrete", repU: 1, repV: 1, roughness: 0.95 };
export const AMETHYST: Mat = { name: "Crystal", color: "#8e5bd6", roughness: 0.15, metalness: 0.1, emissive: 0.35 };
