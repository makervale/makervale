/** The built-in figure's look: skin, hair, clothes, build and height. */
import type { HairStyle, Look } from "@/avatar/look";
import { HAIRS, SKINS } from "@/avatar/look";
import { GESTURES } from "@/avatar/gestures";
import { esc } from "@/ui/dom";

const HAIR_NAMES: Record<HairStyle, string> = {
  short: "Short",
  long: "Long",
  bun: "Bun",
  curly: "Curly",
  none: "None",
};

/** look fields that are numbers; the rest are colours or names */
export const NUMERIC_LOOK = new Set(["build", "height"]);

function swatch(key: string, value: string, label: string): string {
  return (
    `<label class="mp-sw" title="${label}"><span style="background:${value}"></span>` +
    `<input type="color" data-look="${key}" value="${value}" aria-label="${label}"><i>${label}</i></label>`
  );
}

function skinRow(look: Look): string {
  const skins = SKINS.map(
    (c) =>
      `<button class="mp-skin" data-skin="${c}" style="background:${c}" aria-pressed="${look.skin === c}"
        title="Skin tone"></button>`,
  );
  return `<div class="mp-row"><span class="lbl">Skin</span>${skins.join("")}</div>`;
}

function hairRow(look: Look): string {
  const options = HAIRS.map(
    (h) => `<option value="${h}" ${look.hair === h ? "selected" : ""}>${HAIR_NAMES[h]}</option>`,
  );
  const select = `<select class="cb" data-look="hair">${options.join("")}</select>`;
  const color = swatch("hairColor", look.hairColor, "Hair");
  return `<div class="mp-row"><span class="lbl">Hair</span>${select}${color}</div>`;
}

function shapeRow(look: Look): string {
  const build = `<input type="range" min="0" max="1" step="0.05" value="${look.build}" data-look="build"
    aria-label="Build">`;
  const height = `<input type="range" min="0.9" max="1.1" step="0.01" value="${look.height}" data-look="height"
    aria-label="Height">`;
  return `<div class="mp-row"><span class="lbl">Build</span>${build}<span class="lbl">Height</span>${height}</div>`;
}

export function lookEditorHTML(look: Look): string {
  const clothes =
    swatch("shirt", look.shirt, "Shirt") +
    swatch("pants", look.pants, "Trousers") +
    swatch("shoes", look.shoes, "Shoes");
  const rows = skinRow(look) + hairRow(look) + `<div class="mp-row">${clothes}</div>` + shapeRow(look);
  return `<div class="mp-look">${rows}</div>`;
}

export function gestureButtonsHTML(): string {
  return Object.entries(GESTURES)
    .map(([id, g]) => `<button class="btn small" data-gesture="${id}">${esc(g.label)}</button>`)
    .join("");
}
