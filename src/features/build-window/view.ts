/** The Build window's markup: header, tools row, mode block, At hand, last operation, status, tabs. */

const ICON = {
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
  scale: '<rect x="4" y="9" width="11" height="11" rx="1"/><path d="M13 4h7v7M20 4l-7 7"/>',
  create: '<path d="M10 4 17 8v8l-7 4-7-4V8Z"/><path d="M10 12 17 8M10 12l-7-4M10 12v8M19 2v6M16 5h6"/>',
  catalog: '<path d="M4 5h6v14H4zM14 5h6v14h-6z"/><path d="M6 9h2M6 12h2M16 9h2M16 12h2"/>',
};
const svg = (p: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${p}</svg>`;
export const CLOSE_ICON =
  '<svg viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6"><path d="M1 1l8 8M9 1 1 9"/></svg>';

const TOOLS_ROW = `
    <div class="toolsrow" role="toolbar" aria-label="Tools">
      <button class="ibtn" data-manip="move" title="Move: arrows and ruler">${svg(ICON.move)}</button>
      <button class="ibtn" data-manip="rotate" title="Rotate (hold Ctrl)">${svg(ICON.rotate)}</button>
      <button class="ibtn" data-manip="scale" title="Stretch (hold Ctrl+Shift)">${svg(ICON.scale)}</button>
      <span class="sep"></span>
      <button class="ibtn" data-create title="Create: pick a shape and click the world">${svg(ICON.create)}</button>
      <button class="ibtn cat" data-open-catalog title="All tools (Ctrl+K)">${svg(ICON.catalog)}</button>
    </div>`;

const TABS =
  '<div class="tabs" role="tablist">' +
  '<button class="tab" role="tab" data-tab="obj">Object</button>' +
  '<button class="tab" role="tab" data-tab="mat">Material</button>' +
  '<button class="tab" role="tab" data-tab="script">Script</button>' +
  '<button class="tab" role="tab" data-tab="scene">Scene</button></div>';

const BODY = `${TOOLS_ROW}
    <div class="block" id="b-mode"></div>
    <div class="block" id="b-quick"></div>
    <div class="lastop" id="b-last" hidden></div>
    <div class="status" id="b-status"></div>
    ${TABS}
    <div class="tbody" id="b-tab"></div>`;

export const BUILD_HTML = `<section class="floater" id="build" aria-label="Build" hidden>
  <div class="fhead" data-drag><span class="ft">Build</span><button class="x" data-close="build" title="Close (Ctrl+B)">${CLOSE_ICON}</button></div>
  <div class="fbody" id="build-body">${BODY}</div>
</section>`;
