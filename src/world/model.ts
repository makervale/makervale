import type { Mesh } from "@/lib/mesh/mesh";
import { cloneMesh } from "@/lib/mesh/mesh";
import type { Quat, Vec3 } from "@/lib/vec";

export interface Material {
  name: string;
  color: string;
  pattern: string;
  repU: number;
  repV: number;
  rot: number;
  offU: number;
  offV: number;
  roughness: number;
  metalness: number;
  opacity: number;
  emissive: number;
}

/** what a script keeps between runs */
/** how the object looked when its script started: what a save keeps (see world/resting.ts) */
export interface RestingLook {
  materials: Material[];
  hidden: boolean;
  spin?: Vec3;
  label?: string;
}

export interface ScriptState {
  src: string;
  /** the script's `state` table, as plain JSON */
  state: unknown;
  home: { pos: Vec3; quat: Quat; size: Vec3; look?: RestingLook };
  pivot?: Vec3;
}

/** a physical object: it falls, rolls and bounces, and people push it by walking into it */
export interface Body {
  shape: "ball";
  /** 0 dead … 1 perfectly bouncy */
  bounce: number;
}

export interface Obj {
  id: string;
  name: string;
  pos: Vec3;
  quat: Quat;
  size: Vec3;
  mesh: Mesh;
  materials: Material[];
  group: string | null;
  hidden: boolean;
  locked: boolean;
  script?: string;
  /** continuous visual rotation in degrees per second about local X, Y, Z */
  spin?: Vec3;
  /** a line or two of text shown above the object (a script's label()) */
  label?: string;
  scriptState?: ScriptState;
  body?: Body;
  /** a trampoline: standing on it throws you up at this speed, m/s */
  spring?: number;
}

export interface World {
  /** next object number; ids are "o" + seq */
  seq: number;
  objects: Obj[];
}

export const emptyWorld = (): World => ({ seq: 1, objects: [] });

export function defaultMaterial(over: Partial<Material> = {}): Material {
  return {
    name: "Material 1",
    color: "#c9c4b8",
    pattern: "none",
    repU: 1,
    repV: 1,
    rot: 0,
    offU: 0,
    offV: 0,
    roughness: 0.8,
    metalness: 0,
    opacity: 1,
    emissive: 0,
    ...over,
  };
}

export interface NewObjOptions {
  name?: string;
  material?: Partial<Material>;
}

export function newObj(world: World, mesh: Mesh, pos: Vec3, size: Vec3, options: NewObjOptions = {}): Obj {
  return {
    id: "o" + world.seq++,
    name: options.name ?? "Object",
    pos: [...pos],
    quat: [0, 0, 0, 1],
    size: [...size],
    mesh,
    materials: [defaultMaterial(options.material)],
    group: null,
    hidden: false,
    locked: false,
  };
}

export function cloneObj(o: Obj): Obj {
  return {
    ...o,
    pos: [...o.pos],
    quat: [...o.quat],
    size: [...o.size],
    mesh: cloneMesh(o.mesh),
    materials: o.materials.map((m) => ({ ...m })),
    spin: o.spin ? [...o.spin] : undefined,
    scriptState: o.scriptState ? structuredClone(o.scriptState) : undefined,
  };
}

export const materialOf = (o: Obj, slot: number): Material => o.materials[slot] ?? o.materials[0];

/** every material slot the mesh refers to exists */
export function ensureMaterialSlots(o: Obj): void {
  const highest = Math.max(0, ...o.mesh.fm);
  while (o.materials.length <= highest) {
    o.materials.push({ ...o.materials[0], name: `Material ${o.materials.length + 1}` });
  }
}

export const findObj = (world: World, id: string): Obj | undefined => world.objects.find((o) => o.id === id);

export function groupOf(world: World, o: Obj): Obj[] {
  return o.group ? world.objects.filter((p) => p.group === o.group) : [o];
}

/** these objects replace their namesakes (or join the end), and these go */
export function upsert(world: World, set: Obj[], del: string[]): void {
  world.objects = world.objects.filter((o) => !del.includes(o.id));
  for (const o of set) {
    const i = world.objects.findIndex((x) => x.id === o.id);
    if (i >= 0) world.objects[i] = o;
    else world.objects.push(o);
  }
}
