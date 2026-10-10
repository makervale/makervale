import { Bus } from "@/app/bus";
import { Commands } from "@/app/commands";
import { Store } from "@/app/store";
import type { ToolDef } from "@/app/tools";

/** what tools that change modes, options or ask other features for something need */
export interface ToolApp {
  store: Store;
  commands: Commands;
  bus: Bus;
}

/** a store of its own, for previews and tests that only run mesh tools */
export function standaloneToolApp(): ToolApp {
  const store = new Store();
  const bus = new Bus();
  return { store, bus, commands: new Commands(store, bus) };
}

/** a catalog card; `pie` puts it in the pie menu */
export type CatalogTool = ToolDef & { pie?: boolean };

export interface Category {
  id: string;
  name: string;
  note: string;
}

export const CATEGORIES: Category[] = [
  { id: "create", name: "Create", note: "Starting shapes. Each one is an editable mesh right away." },
  { id: "select", name: "Select", note: "Ways to select many elements at once." },
  { id: "transform", name: "Transform", note: "Moving, rotating, aligning and smoothing." },
  { id: "faces", name: "Faces", note: "Extruding, insetting, filling and tidying up faces." },
  { id: "edges", name: "Edges", note: "Cutting and dissolving edges." },
  { id: "verts", name: "Vertices", note: "Merging and connecting points." },
  { id: "mesh", name: "Whole mesh", note: "Operations on the whole object: subdivide, mirror, merge." },
  { id: "objects", name: "Objects & scene", note: "Duplicating, groups, pivot, hiding." },
  { id: "material", name: "Materials", note: "Assigning materials to faces." },
  { id: "quality", name: "Quality & export", note: "Checking the mesh and saving for other programs." },
];
