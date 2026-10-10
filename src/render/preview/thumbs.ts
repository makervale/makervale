/**
 * Tool thumbnails as data URLs, drawn once and cached. Shared with the Build window (its Create shapes) through a
 * port that main.ts wires to `thumbnail`, since features don't import each other.
 */
import type { ToolDef } from "@/app/tools";
import { runDemo } from "./demo";
import { draw, fitBoth } from "./draw";

const DEFAULT_PX = 88;
const cache = new Map<string, string>();

const keyOf = (id: string, size: number): string => id + "|" + size;

export const cachedThumbnail = (id: string, size: number): string => cache.get(keyOf(id, size)) ?? "";

function canvasOf(size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

export function thumbnail(t: ToolDef, size = DEFAULT_PX): string {
  const key = keyOf(t.id, size);
  const hit = cache.get(key);
  if (hit) return hit;
  const res = runDemo(t);
  const c = canvasOf(size);
  if (res.after && res.after.mesh.v.length) {
    draw(c, res.after.mesh, res.after.selection, 0, fitBoth(res.before?.mesh ?? null, res.after.mesh));
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
