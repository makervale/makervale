/**
 * Time of day: midday, sunset, night, or a slow cycle (a full day in 20 minutes).
 * The sun moves, light and sky colours follow it, stars come out, and at night glowing objects light their
 * surroundings.
 */
import * as THREE from "three";
import type { Obj } from "@/world/model";
import { NightLamps } from "./night-lamps";
import type { SceneParts } from "./scene";
import { skyLightAt } from "./sky-palette";
import { Stars } from "./stars";

export type TimeOfDay = "day" | "sunset" | "night" | "cycle";

/** phase of the day: 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset */
const PHASE: Record<Exclude<TimeOfDay, "cycle">, number> = { day: 0.42, sunset: 0.74, night: 0 };
const CYCLE_S = 20 * 60;
const EASE_RATE = 1.5;
const SUN_PEAK_DEGREES = 62;
/** below this the light comes from the moon */
const MOON_BELOW_DEGREES = -6;
const SUN_DISTANCE_M = 30;

export class Sky {
  mode: TimeOfDay = "day";
  /** 0 in daylight … 1 at night (ambient sound follows it) */
  darkness = 0;
  private phase = PHASE.day;
  private target = PHASE.day;
  private readonly stars: Stars;
  private readonly lamps: NightLamps;
  private lastSkyKey = "";

  constructor(
    private readonly parts: SceneParts,
    private readonly setSkyColors: (top: string, bottom: string) => void,
  ) {
    this.stars = new Stars(parts.scene);
    this.lamps = new NightLamps(parts.scene);
  }

  set(mode: TimeOfDay, immediately = false): void {
    this.mode = mode;
    if (mode !== "cycle") this.target = PHASE[mode];
    if (immediately && mode !== "cycle") this.phase = this.target;
  }

  /** glowing objects may have changed */
  scan(objects: Obj[]): void {
    this.lamps.scan(objects);
  }

  update(dt: number, objects: Obj[]): void {
    this.advance(dt);
    const angle = (this.phase - 0.25) * Math.PI * 2;
    const elevation = Math.sin(angle) * SUN_PEAK_DEGREES;
    this.light(angle, elevation);
    const dark = Math.min(1, Math.max(0, (-elevation + 2) / 14));
    this.darkness = dark;
    this.stars.update(dark, this.parts.camera.position);
    this.lamps.update(objects, this.parts.camera.position, dark);
  }

  private advance(dt: number): void {
    if (this.mode === "cycle") {
      this.phase = (this.phase + dt / CYCLE_S) % 1;
      return;
    }
    let d = this.target - this.phase;
    d -= Math.round(d); // the short way round the clock
    this.phase = (this.phase + d * (1 - Math.exp(-dt * EASE_RATE)) + 1) % 1;
  }

  private light(angle: number, elevation: number): void {
    const { sun, hemi, sunOffset } = this.parts;
    const s = skyLightAt(elevation);
    const moon = elevation < MOON_BELOW_DEGREES;
    const dir = moon
      ? new THREE.Vector3(-Math.cos(angle), 0.35, -Math.sin(angle) * 0.9 + 0.2)
      : new THREE.Vector3(Math.cos(angle), -0.35, Math.max(0.12, Math.sin(angle)));
    sunOffset.copy(dir.normalize().multiplyScalar(SUN_DISTANCE_M));
    sun.color.copy(s.sun);
    sun.intensity = s.sunIntensity;
    hemi.color.copy(s.ambientSky);
    hemi.groundColor.copy(s.ambientGround);
    hemi.intensity = s.ambientIntensity;
    const key = s.top.getHexString() + s.bottom.getHexString();
    if (key === this.lastSkyKey) return;
    this.lastSkyKey = key;
    this.setSkyColors("#" + s.top.getHexString(), "#" + s.bottom.getHexString());
  }
}
