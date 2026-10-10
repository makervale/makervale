/** Scene tab: every object (groups folded together) with show/hide and lock; click to select. */
import type { Obj } from "@/world/model";
import { esc } from "@/ui/dom";
import type { Build, Clicks } from "./context";

const EYE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/></svg>';
const LOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

function row(b: Build, o: Obj, child: boolean): string {
  const selected = b.deps.store.selection.objects.has(o.id);
  const eye = `<button class="ib ${o.hidden ? "" : "on"}" data-vis="${o.id}" title="${o.hidden ? "Show" : "Hide"}">${EYE}</button>`;
  const lock = `<button class="ib ${o.locked ? "on" : ""}" data-lock="${o.id}" title="${o.locked ? "Unlock" : "Lock"}">${LOCK}</button>`;
  return (
    `<div class="orow ${child ? "child" : ""} ${o.hidden ? "hidden" : ""}" data-oid="${o.id}" aria-selected="${selected}">` +
    `${eye}${lock}<span class="n">${esc(o.name)}</span><span class="c">${o.mesh.f.length}</span></div>`
  );
}

export function sceneTab(b: Build): string {
  const objs = b.deps.store.world.objects;
  if (!objs.length) return '<div class="empty">The scene is empty. Choose <b>Create</b>.</div>';
  const seen = new Set<string>();
  let h = '<div class="outliner">';
  for (const o of objs) {
    if (!o.group) {
      h += row(b, o, false);
      continue;
    }
    if (seen.has(o.group)) continue;
    seen.add(o.group);
    const members = objs.filter((p) => p.group === o.group);
    h +=
      `<div class="orow grp" data-group="${o.group}">Group (${members.length})</div>` +
      members.map((p) => row(b, p, true)).join("");
  }
  return (
    h +
    '</div><div class="row" style="gap:4px;margin-top:6px"><button class="btn small" data-run="group">Group</button>' +
    '<button class="btn small" data-run="ungroup">Ungroup</button><button class="btn small" data-run="unhide">Show all</button></div>'
  );
}

function toggleHidden(b: Build, o: Obj): void {
  const { store, commands } = b.deps;
  commands.act("Visibility", [o.id], () => (o.hidden = !o.hidden));
  const sel = store.selection.objects;
  if (o.hidden && sel.has(o.id)) commands.selectObjects([...sel].filter((id) => id !== o.id));
}

/** a row selects just that part, even inside a group; Shift adds or removes it */
function selectRow(b: Build, o: Obj, additive: boolean): void {
  const sel = b.deps.store.selection.objects;
  if (o.hidden) return;
  let ids = [o.id];
  if (additive) ids = sel.has(o.id) ? [...sel].filter((id) => id !== o.id) : [...sel, o.id];
  b.deps.commands.selectObjects(ids);
}

function withObj(b: Build, id: string | undefined, run: (o: Obj) => void): void {
  const o = id ? b.deps.store.byId(id) : undefined;
  if (o) run(o);
}

export const SCENE_CLICKS: Clicks = [
  ["[data-vis]", (b, el) => withObj(b, el.dataset.vis, (o) => toggleHidden(b, o))],
  [
    "[data-lock]",
    (b, el) => withObj(b, el.dataset.lock, (o) => b.deps.commands.act("Lock", [o.id], () => (o.locked = !o.locked))),
  ],
  ["[data-oid]", (b, el, e) => withObj(b, el.dataset.oid, (o) => selectRow(b, o, e.shiftKey))],
  [
    "[data-group]",
    (b, el) => {
      const members = b.deps.store.world.objects.filter((p) => p.group === el.dataset.group && !p.hidden);
      b.deps.commands.selectObjects(members.map((p) => p.id));
      b.deps.commands.setMode("object");
    },
  ],
];
