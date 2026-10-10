/** The camera controls window: orbit and pan pads, a zoom slider and preset views. */
const CLOSE_ICON =
  '<svg viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6"><path d="M1 1l8 8M9 1 1 9"/></svg>';
const ARROWS = {
  n: '<path d="M7 3l4 5H3z"/>',
  s: '<path d="M7 11 3 6h8z"/>',
  w: '<path d="M3 7l5-4v8z"/>',
  e: '<path d="M11 7 6 3v8z"/>',
};

type Side = keyof typeof ARROWS;

function arrow(side: Side, cam: string, title: string): string {
  const icon = `<svg viewBox="0 0 14 14" fill="currentColor">${ARROWS[side]}</svg>`;
  return `<button class="${side}" data-cam="${cam}" title="${title}">${icon}</button>`;
}

function pad(kind: "orbit" | "pan", caption: string): string {
  const up = kind === "orbit" ? "0:1" : "0:-1";
  const down = kind === "orbit" ? "0:-1" : "0:1";
  const name = kind === "orbit" ? "Orbit" : "Pan";
  return `<div class="pad"><b></b>
    ${arrow("n", `${kind}:${up}`, `${name} up`)}
    ${arrow("s", `${kind}:${down}`, `${name} down`)}
    ${arrow("w", `${kind}:1:0`, `${name} left`)}
    ${arrow("e", `${kind}:-1:0`, `${name} right`)}
    <span class="cap">${caption}</span></div>`;
}

const PRESETS: [string, string][] = [
  ["front", "Front"],
  ["side", "Side"],
  ["rear", "Back"],
  ["top", "Top"],
  ["home", "Reset"],
];

export function cameraWindowHtml(): string {
  const presets = PRESETS.map(([k, label]) => `<button class="btn small" data-preset="${k}">${label}</button>`);
  return `<section class="floater" id="camfl" aria-label="Camera controls" hidden>
  <div class="fhead" data-drag><span class="ft">Camera controls</span>
    <button class="x" data-close="camfl" title="Close">${CLOSE_ICON}</button></div>
  <div class="fbody">
    <div class="camgrid">
      ${pad("orbit", "Orbit")}
      ${pad("pan", "Pan")}
      <div class="zoomcol"><button data-cam="zoom:1" title="Zoom in">+</button>
        <input type="range" id="zoomslider" min="0" max="100" value="50" aria-label="Zoom">
        <button data-cam="zoom:-1" title="Zoom out">−</button></div>
    </div>
    <div class="campresets">${presets.join("")}</div>
  </div>
</section>`;
}
