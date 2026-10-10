/** Small DOM and text helpers shared by every window. */
export const $ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T =>
  root.querySelector(selector) as T;

export const $$ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T[] => [
  ...root.querySelectorAll<T>(selector),
];

/** escape text for use inside HTML or an attribute */
export const esc = (s: string): string =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** a number for display; never prints "-0.000" */
export const fmt = (n: number, decimals = 3): string => (Math.abs(n) < 1e-9 ? 0 : n).toFixed(decimals);

/** accepts "1,5" and the typographic minus people paste */
export const parseNum = (s: string): number => parseFloat(String(s).replace(",", ".").replace("−", "-"));

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const DIACRITICS: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };

/** for search: lower case, no Polish diacritics */
export const norm = (s: string): string => s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => DIACRITICS[c]);

export function checkbox(id: string, label: string, checked: boolean, title = ""): string {
  const on = checked ? "checked" : "";
  return `<label class="check" title="${esc(title)}"><input type="checkbox" id="${id}" ${on}>${label}</label>`;
}

/** create an element with a class and optional text */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}
