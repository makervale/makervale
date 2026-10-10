/**
 * Who you are: your name and look, kept in this browser. main.ts loads it once and hands the same object to the
 * session (selfName/selfLook), the avatar and the windows; the Avatar window is the only one that changes it.
 */
import type { Look } from "@/avatar/look";
import { cleanLook, DEFAULT_LOOK, HAIRS, SKINS } from "@/avatar/look";

export interface Identity {
  name: string;
  look: Look;
}

export const NAME_KEY = "pias.name";
export const LOOK_KEY = "pias.look";
/** older versions kept only a shirt colour */
const COLOR_KEY = "pias.color";
export const MAX_NAME = 32;

const SHIRTS = ["#3d6fa8", "#a8433d", "#3d8a52", "#8a5aa8", "#c08a2e", "#2e8a8a", "#c25a87", "#5a5a5a"];
const HAIR_COLORS = ["#2a1f18", "#4a3426", "#8a5a32", "#c99a5b", "#e3c27a", "#a33a22", "#8e8e8e", "#efefef"];
const RESIDENT_NUMBER = { from: 1000, count: 9000 };

export type Random = () => number;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* no storage here: you are a new resident next time */
  }
}

const pick = <T>(list: readonly T[], random: Random): T => list[Math.floor(random() * list.length)];

/** a first-time visitor gets a random look, so a room full of newcomers doesn't look like clones */
export function randomLook(random: Random, shirt?: string): Look {
  return cleanLook({
    ...DEFAULT_LOOK,
    shirt: shirt ?? pick(SHIRTS, random),
    skin: pick(SKINS, random),
    hair: pick(
      HAIRS.filter((h) => h !== "none"),
      random,
    ),
    hairColor: pick(HAIR_COLORS, random),
  });
}

function savedLook(): Look | null {
  const json = read(LOOK_KEY);
  if (!json) return null;
  try {
    return cleanLook(JSON.parse(json));
  } catch {
    return null;
  }
}

export function loadIdentity(random: Random = Math.random): Identity {
  const name = read(NAME_KEY) || "Resident " + Math.floor(RESIDENT_NUMBER.from + random() * RESIDENT_NUMBER.count);
  const look = savedLook() ?? randomLook(random, read(COLOR_KEY) || undefined);
  return { name, look };
}

export function storeIdentity(who: Identity): void {
  write(NAME_KEY, who.name);
  write(LOOK_KEY, JSON.stringify(who.look));
}

/** a typed name: trimmed and capped; empty keeps the old one */
export const cleanName = (typed: string, current: string): string => typed.trim().slice(0, MAX_NAME) || current;
