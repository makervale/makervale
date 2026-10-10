/** Export the selection (or the whole visible scene) as STL for 3D printing or OBJ + MTL in a zip. */
import { zipSync } from "fflate";
import { composeMatrix } from "@/lib/mesh/affine";
import { toOBJ, toSTL } from "@/lib/mesh/io";
import type { Store } from "@/app/store";
import type { Obj } from "@/world/model";
import { toast } from "@/ui/toast";
import { offerFile } from "./download";

const MM_PER_M = 1000;

/** the selected visible objects, or every visible one */
export function exportSet(store: Store): Obj[] {
  const selected = store.selected().filter((o) => !o.hidden);
  return selected.length ? selected : store.visibleObjects();
}

const matrixOf = (o: Obj): number[] => composeMatrix(o.pos, o.quat, o.size);

function nothingToExport(objs: Obj[]): boolean {
  if (objs.length) return false;
  toast("The scene is empty");
  return true;
}

export async function exportStl(store: Store): Promise<void> {
  const objs = exportSet(store);
  if (nothingToExport(objs)) return;
  const buf = toSTL(
    objs.map((o) => ({ mesh: o.mesh, matrix: matrixOf(o) })),
    MM_PER_M,
  );
  await offerFile("makervale.stl", new Blob([buf], { type: "model/stl" }));
}

export async function exportObj(store: Store): Promise<void> {
  const objs = exportSet(store);
  if (nothingToExport(objs)) return;
  const { obj, mtl } = toOBJ(
    objs.map((o) => ({
      name: o.name,
      mesh: o.mesh,
      matrix: matrixOf(o),
      materials: o.materials.map((m) => ({ name: m.name, color: m.color })),
    })),
  );
  const enc = new TextEncoder();
  const zip = zipSync({ "makervale.obj": enc.encode(obj), "makervale.mtl": enc.encode(mtl) });
  await offerFile("makervale-obj.zip", new Blob([zip]));
}
