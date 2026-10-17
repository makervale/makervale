/** Everything that arrives from other people in a room is checked and rebuilt here before it touches the scene. */
import type { Mesh } from "@/lib/mesh/mesh";
import type { Quat, Vec3 } from "@/lib/vec";
import type { Material, Obj, RestingLook, ScriptState } from "@/world/model";
import { defaultMaterial } from "@/world/model";
import { stripControl } from "@/lib/text";
import type { Transform } from "./messages";
import type { BodyState } from "./physics-bridge";

const MAX_VERTS = 300_000;
const MAX_FACES = 300_000;
const MAX_MATS = 32;
const MAX_FACE_SIDES = 256;
const MAX_SCRIPT = 10_000;
const MAX_LABEL = 200;
const COORD_LIMIT = 1e6;
const MESH_LIMIT = 1e4;
const MIN_SIZE = 1e-6;
const MAX_SIZE = 1e5;
const MAX_SPIN_DEG_S = 720;
const MAX_SPRING_M_S = 30;
const MAX_FX_SECONDS = 600;

/** a finite number, clamped; null for anything else */
export const cleanNum = (x: unknown, lo = -COORD_LIMIT, hi = COORD_LIMIT): number | null =>
  typeof x === "number" && isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null;

const str = (x: unknown, n: number): string => (typeof x === "string" ? stripControl(x).slice(0, n) : "");

/** printable text, trimmed, at most n characters ("" when it isn't text) */
export const cleanText = (x: unknown, n: number): string => str(x, n).trim();

export const validId = (x: unknown): x is string => typeof x === "string" && /^[\w-]{1,48}$/.test(x);

function vec(x: unknown, n: number, lo?: number, hi?: number): number[] | null {
  if (!Array.isArray(x) || x.length !== n) return null;
  const out = x.map((v) => cleanNum(v, lo, hi));
  return out.some((v) => v === null) ? null : (out as number[]);
}

export const cleanVec3 = (x: unknown, lo?: number, hi?: number): Vec3 | null => vec(x, 3, lo, hi) as Vec3 | null;

/** quaternions arrive normalised; anything with a component past 1 (plus rounding) is rejected, not clamped */
export function cleanQuat(x: unknown): Quat | null {
  if (!Array.isArray(x) || x.length !== 4) return null;
  const ok = x.every((v) => typeof v === "number" && isFinite(v) && Math.abs(v) <= 1.0001);
  return ok ? ([...x] as Quat) : null;
}

const cleanSize = (x: unknown): Vec3 | null => cleanVec3(x, MIN_SIZE, MAX_SIZE);

/* ---------- objects ---------- */

/** render draws an unknown pattern as plain grey, so only the shape of the name is checked here */
const PATTERN_NAME = /^[a-z][a-z0-9]{0,23}$/;

function material(m: any): Material {
  const d = defaultMaterial();
  if (!m || typeof m !== "object") return d;
  const n = (k: keyof Material, lo: number, hi: number) => cleanNum(m[k], lo, hi) ?? (d[k] as number);
  return {
    name: str(m.name, 60) || d.name,
    color: typeof m.color === "string" && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : d.color,
    pattern: typeof m.pattern === "string" && PATTERN_NAME.test(m.pattern) ? m.pattern : "none",
    repU: n("repU", 0.001, 1000),
    repV: n("repV", 0.001, 1000),
    rot: n("rot", -360, 360),
    offU: n("offU", -1000, 1000),
    offV: n("offV", -1000, 1000),
    roughness: n("roughness", 0, 1),
    metalness: n("metalness", 0, 1),
    opacity: n("opacity", 0, 1),
    emissive: n("emissive", 0, 5),
  };
}

function faces(raw: any[], vertCount: number): number[][] | null {
  const out: number[][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 3 || p.length > MAX_FACE_SIDES) return null;
    if (!p.every((k) => Number.isInteger(k) && k >= 0 && k < vertCount)) return null;
    out.push(p.slice());
  }
  return out;
}

/** per-face UVs, or undefined when they don't match the faces (the mesh is still fine without them) */
function faceUVs(raw: unknown, f: number[][]): [number, number][][] | undefined {
  if (!Array.isArray(raw) || raw.length !== f.length) return undefined;
  const out: [number, number][][] = [];
  for (let i = 0; i < f.length; i++) {
    const corners = raw[i];
    if (!Array.isArray(corners) || corners.length !== f[i].length) return undefined;
    const row = corners.map((q) => vec(q, 2, -MESH_LIMIT, MESH_LIMIT));
    if (row.some((w) => !w)) return undefined;
    out.push(row as [number, number][]);
  }
  return out;
}

function mesh(m: any, materialCount: number): Mesh | null {
  if (!m || !Array.isArray(m.v) || !Array.isArray(m.f)) return null;
  if (m.v.length > MAX_VERTS || m.f.length > MAX_FACES) return null;
  const v = m.v.map((p: unknown) => cleanVec3(p, -MESH_LIMIT, MESH_LIMIT));
  if (v.some((p: Vec3 | null) => !p)) return null;
  const f = faces(m.f, v.length);
  if (!f) return null;
  const fm = f.map((_, i) => {
    const s = Array.isArray(m.fm) ? m.fm[i] : 0;
    return Number.isInteger(s) && s >= 0 && s < materialCount ? s : 0;
  });
  const out: Mesh = { v, f, fm };
  const uv = faceUVs(m.uv, f);
  if (uv) out.uv = uv;
  return out;
}

export function sanitizeObj(o: any): Obj | null {
  if (!o || typeof o !== "object" || !validId(o.id)) return null;
  const pos = cleanVec3(o.pos);
  const quat = vec(o.quat, 4, -1, 1) as Quat | null;
  const size = cleanSize(o.size);
  if (!pos || !quat || !size) return null;
  const materials = (Array.isArray(o.materials) ? o.materials.slice(0, MAX_MATS) : []).map(material);
  if (!materials.length) materials.push(defaultMaterial());
  const m = mesh(o.mesh, materials.length);
  if (!m) return null;
  return {
    id: o.id,
    name: str(o.name, 80) || "Object",
    pos,
    quat,
    size,
    mesh: m,
    materials,
    group: validId(o.group) ? o.group : null,
    hidden: !!o.hidden,
    locked: !!o.locked,
    ...scripted(o),
  };
}

/* ---------- scripts on objects ---------- */

const MAX_STATE_NODES = 5000;
const MAX_STATE_DEPTH = 16;

/** a script's `state`: plain JSON, of limited size and depth; anything else is dropped */
function cleanState(x: unknown, budget = { n: MAX_STATE_NODES }, depth = 0): unknown {
  if (--budget.n < 0 || depth > MAX_STATE_DEPTH) return null;
  if (typeof x === "number") return isFinite(x) ? x : null;
  if (typeof x === "boolean") return x;
  if (typeof x === "string") return x.slice(0, 1000);
  if (Array.isArray(x)) return x.map((v) => cleanState(v, budget, depth + 1));
  return isRecord(x) ? cleanStateObject(x, budget, depth) : null;
}

function cleanStateObject(x: Record<string, unknown>, budget: { n: number }, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x))
    if (budget.n > 0 && k.length <= 100) out[k] = cleanState(v, budget, depth + 1);
  return out;
}

function scriptState(o: any): ScriptState | undefined {
  const st = o.scriptState;
  if (!st || typeof st !== "object" || typeof st.src !== "string" || st.src.length >= 20) return undefined;
  const home = cleanHome(st.home);
  if (!home) return undefined;
  return { src: st.src, state: cleanState(st.state), home, pivot: cleanVec3(st.pivot, -2, 2) ?? undefined };
}

const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

function cleanHome(h: any): ScriptState["home"] | null {
  if (!h) return null;
  const pos = cleanVec3(h.pos);
  const quat = vec(h.quat, 4, -1, 1) as Quat | null;
  const size = cleanSize(h.size);
  if (!pos || !quat || !size) return null;
  const look = cleanLook(h.look);
  return look ? { pos, quat, size, look } : { pos, quat, size };
}

function cleanLook(l: any): RestingLook | null {
  if (!l || !Array.isArray(l.materials) || !l.materials.length) return null;
  const spin = cleanVec3(l.spin, -MAX_SPIN_DEG_S, MAX_SPIN_DEG_S) ?? undefined;
  const look: RestingLook = {
    materials: l.materials.slice(0, MAX_MATS).map(material),
    hidden: l.hidden === true,
    spin,
  };
  const text = label(l.label);
  if (text) look.label = text;
  return look;
}

/** a script's label: a few lines of text */
const label = (x: unknown): string => (typeof x === "string" ? stripControl(x, true).slice(0, MAX_LABEL).trim() : "");

/** script, spin, label, script state and physics, if present and sane */
function scripted(o: any): Partial<Obj> {
  const out: Partial<Obj> = {};
  if (typeof o.script === "string" && o.script.length <= MAX_SCRIPT) {
    out.script = stripControl(o.script, true);
  }
  const spin = cleanVec3(o.spin, -MAX_SPIN_DEG_S, MAX_SPIN_DEG_S);
  if (spin && spin.some((v) => v !== 0)) out.spin = spin;
  const text = label(o.label);
  if (text) out.label = text;
  const state = out.script ? scriptState(o) : undefined;
  if (state) out.scriptState = state;
  if (o.body?.shape === "ball") out.body = { shape: "ball", bounce: cleanNum(o.body.bounce, 0, 1) ?? 0.5 };
  const spring = cleanNum(o.spring, 0, MAX_SPRING_M_S);
  if (spring) out.spring = spring;
  return out;
}

/* ---------- small messages ---------- */

export function cleanTransform(x: any): Transform | null {
  if (!x || !validId(x.id)) return null;
  const pos = cleanVec3(x.pos);
  const size = cleanSize(x.size);
  const quat = cleanQuat(x.quat);
  return pos && size && quat ? { id: x.id, pos, quat, size } : null;
}

/** a script's smooth move: where to, how long (seconds), and the optional pivot (world point + local point) */
export interface Fx extends Transform {
  d: number;
  pv?: number[];
}

export function cleanFx(x: any): Fx | null {
  const t = cleanTransform(x);
  const d = cleanNum(x?.d, 0, MAX_FX_SECONDS);
  if (!t || d === null) return null;
  const pv = vec(x.pv, 6) ?? undefined;
  return pv ? { ...t, d, pv } : { ...t, d };
}

/** a list from a peer, cut to a sane length; [] for anything that isn't a list */
export const cleanList = (x: unknown, max: number): unknown[] => (Array.isArray(x) ? x.slice(0, max) : []);

/** a message's fields, or no fields when it isn't an object */
export const asRecord = (x: unknown): Record<string, any> =>
  x && typeof x === "object" ? (x as Record<string, any>) : {};

/** objects from a peer or a saved room: the sane ones, each id once, at most `max` */
export function sanitizeObjects(raw: unknown, max: number): Obj[] {
  const out: Obj[] = [];
  const seen = new Set<string>();
  for (const x of cleanList(raw, max)) {
    const o = sanitizeObj(x);
    if (o && !seen.has(o.id)) out.push(o);
    if (o) seen.add(o.id);
  }
  return out;
}

const MAX_BODY_SPEED_M_S = 60;
const MAX_BODIES = 64;

/** bodies from the authority's physics; anything malformed is dropped */
export function cleanBodies(x: any): BodyState[] {
  const out: BodyState[] = [];
  for (const b of cleanList(x?.b, MAX_BODIES) as any[]) {
    const pos = cleanVec3(b?.pos);
    const quat = cleanQuat(b?.quat);
    const vel = cleanVec3(b?.vel, -MAX_BODY_SPEED_M_S, MAX_BODY_SPEED_M_S);
    if (b && validId(b.id) && pos && quat && vel) out.push({ id: b.id, pos, quat, vel });
  }
  return out;
}
