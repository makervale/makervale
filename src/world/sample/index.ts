/**
 * The start-up showcase: a garden plaza with a domed rotunda, a fountain, a cottage, a gate, railings, lamps, trees
 * and sculptures. Every shape is made only with operations the editor offers as tools (spin, array, radial array,
 * bevel, inset, extrude, solidify, boolean, plane cut, loop cut, subdivide, decimate, merge), so a user can take
 * any of it apart and rebuild it by hand. Shapes are modelled in metres and then fitted into unit space.
 */
import type { World } from "@/world/model";
import { addCottage } from "./cottage";
import { addFountain } from "./fountain";
import { addGate, addRailings } from "./gate";
import { addLanterns } from "./lanterns";
import { addLift } from "./lift";
import { addNature } from "./nature";
import { addPitch } from "./pitch";
import { addPlayground } from "./playground";
import { SceneBuilder } from "./place";
import { addPlaza, addRotunda } from "./rotunda";
import { addPlanters, addSculptures } from "./sculptures";

/**
 * Raise this whenever the start scene changes: visitors who haven't built anything of their own then get the new
 * one, and those who have are offered it (boot/start-world.ts).
 */
export const SAMPLE_VERSION = 5;

/** builds the scene; the order fixes object ids and group names */
export function sampleWorld(): World {
  const b = new SceneBuilder();
  addPlaza(b);
  addRotunda(b);
  addFountain(b);
  addSculptures(b);
  addPlanters(b);
  addLanterns(b);
  addRailings(b);
  addGate(b);
  addLift(b);
  addCottage(b);
  addNature(b);
  addPitch(b);
  addPlayground(b);
  return b.world;
}
