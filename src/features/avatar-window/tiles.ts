/** The model picker: tiles with thumbnails, the collection filter and search. */
import type { IndexEntry, ThumbSheet } from "@/avatar/vrm/registry";
import { AVATARS, BUNDLED, THUMB_SHEET } from "@/avatar/vrm/registry";
import { esc } from "@/ui/dom";

export interface PickerState {
  /** collection index, or -1 for all */
  col: number;
  query: string;
  /** how many of the online avatars are listed */
  shown: number;
}

export const FIRST_PAGE = 60;
export const NEXT_PAGE = 120;

const HIDE_BROKEN = `onerror="this.style.visibility='hidden'"`;

/** where an index entry's thumbnail sits in the sprite sheet published with the page; null if it has none */
export function spritePosition(index: number, sheet: ThumbSheet): { x: number; y: number } | null {
  const k = sheet.have.indexOf(index);
  if (k < 0) return null;
  return { x: (k % sheet.cols) * sheet.tile, y: Math.floor(k / sheet.cols) * sheet.tile };
}

/** a tile without a picture of its own shows the avatar's initial: nothing is ever fetched to draw the list */
function picture(img: string, index: number, name: string): string {
  if (img) return `<img src="${esc(img)}" alt="" loading="lazy" ${HIDE_BROKEN}>`;
  const at = index >= 0 ? spritePosition(index, THUMB_SHEET) : null;
  if (at) {
    const style = `background-image:url(${THUMB_SHEET.file});background-position:-${at.x}px -${at.y}px`;
    return `<i class="sp" style="${style}"></i>`;
  }
  return `<i class="sp letter">${esc(name.trim().charAt(0).toUpperCase())}</i>`;
}

interface Tile {
  name: string;
  model: string;
  /** a picture published with the page */
  img?: string;
  /** the entry's place in the index, for the sprite sheet */
  index?: number;
}

export function tileHTML(t: Tile, worn: string): string {
  const pic = picture(t.img ?? "", t.index ?? -1, t.name);
  const title = t.img ? esc(t.name) : `${esc(t.name)} (downloads when worn)`;
  const pressed = worn === t.model;
  return `<button class="av-tile" data-model="${esc(t.model)}" aria-pressed="${pressed}" title="${title}">
    ${pic}<span>${esc(t.name)}</span></button>`;
}

export function bundledTiles(worn: string): string {
  return BUNDLED.map((b) => {
    const name = AVATARS[b.i].name;
    return tileHTML({ name, model: b.model, img: b.file.replace(/\.glb$/, ".jpg") }, worn);
  }).join("");
}

export function onlineTiles(list: IndexEntry[], worn: string): string {
  return list.map((e) => tileHTML({ name: e.name, model: e.model, index: AVATARS.indexOf(e) }, worn)).join("");
}

export function filterAvatars(all: IndexEntry[], col: number, query: string): IndexEntry[] {
  const q = query.trim().toLowerCase();
  return all.filter((e) => (col < 0 || e.collection === col) && (!q || e.name.toLowerCase().includes(q)));
}

export function modelName(model: string, all: IndexEntry[] = AVATARS): string {
  if (model.startsWith("file:")) return "Your own avatar";
  return all.find((a) => a.model === model)?.name ?? "Avatar";
}
