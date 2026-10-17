/**
 * The start-up plaza: a round square full of games, every one of them a script you can open and change. The sky
 * trail in the east (race the clock to the top), Simon in the west (play the bells' tune back), a gem hunt all
 * over, football on the pitch to the north, and in the middle the hall of fame they all report their records to.
 * A guide greets newcomers at the way in. Shapes are modelled in metres and then fitted into unit space.
 */
import type { World } from "@/world/model";
import { addGarden } from "./garden";
import { addGems } from "./gems";
import { addGround } from "./ground";
import { addHub } from "./hub";
import { addPitch } from "./pitch";
import { SceneBuilder } from "./place";
import { addSimon } from "./simon";
import { addTrail } from "./trail";

/**
 * Raise this whenever the start scene changes: visitors who haven't built anything of their own then get the new
 * one, and those who have are offered it (boot/start-world.ts).
 */
export const SAMPLE_VERSION = 6;

/** builds the scene; the order fixes object ids and group names */
export function sampleWorld(): World {
  const b = new SceneBuilder();
  addGround(b);
  addHub(b);
  addTrail(b);
  addSimon(b);
  addGems(b);
  addPitch(b);
  addGarden(b);
  return b.world;
}
