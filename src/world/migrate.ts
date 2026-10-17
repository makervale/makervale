/**
 * Loading saves made by older versions. Projects and autosaves from v4 on hold meshes already; v1–v3 used
 * Old-style prims with per-face settings, which become a rough mesh and one material per face.
 * Script state was once called `sstate` with its variables in `v`; it is now `scriptState` with `vars`.
 */
import * as G from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Material, Obj, ScriptState, World } from "./model";
import { defaultMaterial } from "./model";

type Raw = Record<string, unknown>;

const isRecord = (x: unknown): x is Raw => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x: unknown, fallback: number): number => (typeof x === "number" ? x : fallback);
/** like `x || fallback` for numbers: a missing value or 0 gives the fallback */
const truthyNum = (x: unknown, fallback: number): number => (typeof x === "number" && x ? x : fallback);
const text = (x: unknown, fallback: string): string => (typeof x === "string" && x ? x : fallback);

/** old prim saves: a rough mesh for each prim type */
const PRIMS: Record<string, () => Mesh> = {
  cylinder: () => G.genCylinder(24),
  sphere: () => G.genSphere(24),
  torus: () => G.genTorus(24),
  tube: () => G.genTorus(24, 0.2),
  ring: () => G.genTorus(24, 0.15),
  prism: () => G.genCone(3),
};

/** old "shine" levels → roughness, metalness */
const SHINE: Record<string, [number, number]> = {
  none: [0.92, 0],
  low: [0.65, 0],
  medium: [0.4, 0],
  high: [0.18, 0.15],
};

/** a project file ({ format, version, world }), an autosave or a bare world → the world */
export function loadWorld(raw: unknown): World {
  const w = isRecord(raw) && isRecord(raw.world) ? raw.world : raw;
  if (!isRecord(w)) return { seq: 1, objects: [] };
  const objects = Array.isArray(w.objects) ? w.objects.filter(isRecord).map(migrateObj) : [];
  return { seq: truthyNum(w.seq, 1), objects };
}

export function migrateObj(o: Raw): Obj {
  if (o.materials && o.mesh && !o.faces) return renameScriptState(o);
  return fromPrim(o);
}

/** a current object, with its script state under today's names */
function renameScriptState(o: Raw): Obj {
  const { sstate, ...rest } = o;
  const obj = rest as unknown as Obj;
  const state = scriptStateOf(o.scriptState ?? sstate);
  if (state) obj.scriptState = state;
  else delete obj.scriptState;
  return obj;
}

function scriptStateOf(st: unknown): ScriptState | undefined {
  if (!isRecord(st) || typeof st.src !== "string" || !isRecord(st.home)) return undefined;
  const state: ScriptState = { src: st.src, state: st.state ?? null, home: st.home as unknown as ScriptState["home"] };
  if (Array.isArray(st.pivot)) state.pivot = st.pivot as ScriptState["pivot"];
  return state;
}

function meshOf(o: Raw): Mesh {
  if (isRecord(o.mesh)) return { v: o.mesh.v, f: o.mesh.f, fm: o.mesh.fm } as Mesh;
  const make = PRIMS[text(o.type, "box")];
  return make ? make() : G.genBox(1);
}

function materialOf(f: Raw, name: string): Material {
  const gloss = typeof f.gloss === "number" ? f.gloss : undefined;
  const sh = SHINE[text(f.shine, "")] ?? (gloss !== undefined ? [Math.max(0.1, 0.92 - gloss * 0.8), 0] : SHINE.none);
  return defaultMaterial({
    name,
    color: text(f.c, "#c9c4b8"),
    pattern: text(f.pat, "none"),
    repU: num(f.ru, 1),
    repV: num(f.rv, 1),
    rot: truthyNum(f.rot, 0),
    offU: truthyNum(f.ou, 0),
    offV: truthyNum(f.ov, 0),
    roughness: sh[0],
    metalness: sh[1],
    opacity: 1 - truthyNum(f.alpha, 0) / 100,
    emissive: f.bright ? 1 : truthyNum(f.glow, 0),
  });
}

/** v1–v3: prims (or early meshes) with per-face settings */
function fromPrim(o: Raw): Obj {
  const faces = Array.isArray(o.faces) && o.faces.length ? o.faces : [{}];
  const keys = isRecord(o.mesh) && Array.isArray(o.mesh.keys) ? o.mesh.keys : [];
  const materials = faces.map((f, i) => materialOf(isRecord(f) ? f : {}, text(keys[i], "Material " + (i + 1))));
  return {
    id: o.id as string,
    name: text(o.name, "Object"),
    pos: o.pos as Obj["pos"],
    quat: (o.quat ?? [0, 0, 0, 1]) as Obj["quat"],
    size: o.size as Obj["size"],
    mesh: meshOf(o),
    materials,
    group: (o.link || o.group || null) as string | null,
    hidden: !!o.hidden,
    locked: !!o.locked,
  };
}
