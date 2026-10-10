/** The Check mesh window: one card per object with the three target profiles and its problems ("Show" selects). */
import type { BuildWindowDeps } from "../deps";
import { emptySelection } from "@/lib/mesh/selection";
import { inspect } from "@/lib/mesh/validate";
import type { Obj } from "@/world/model";
import { $, esc } from "@/ui/dom";
import { showWindow } from "@/ui/window";
import { CLOSE_ICON } from "../view";
import type { Finding, Level } from "./checks";
import { health, profiles } from "./checks";

const FRAME_K = 2.4;

export const REPORT_HTML = `<section class="floater" id="report" aria-label="Mesh report" hidden>
  <div class="fhead" data-drag><span class="ft">Check mesh</span><button class="x" data-close="report" title="Close">${CLOSE_ICON}</button></div>
  <div class="fbody rep" id="report-body"></div>
</section>`;

/** select the elements behind a problem and look at them */
function show(d: BuildWindowDeps, o: Obj, f: Finding): void {
  const { commands } = d;
  commands.selectObjects([o.id]);
  commands.setToolMode("edit");
  if (!f.show || !commands.setMode(f.show.mode)) return;
  const s = emptySelection();
  for (const id of f.show.ids) {
    if (typeof id === "string") s.edges.add(id);
    else if (f.show.mode === "face") s.faces.add(id);
    else s.verts.add(id);
  }
  commands.setElements(s);
  d.renderer.framing.frame([o], undefined, FRAME_K);
}

function objectCard(o: Obj, picks: (() => void)[], d: BuildWindowDeps): string {
  const r = inspect(o.mesh);
  const pr = profiles(o, r);
  const pf = (name: string, [level, text]: [Level, string]) =>
    `<div class="pf ${level}"><b>${name}</b>${esc(text)}</div>`;
  const lines = health(r).map((f) => {
    const i = f.show ? picks.push(() => show(d, o, f)) - 1 : -1;
    const button = i >= 0 ? `<button class="btn small" data-pick="${i}">Show</button>` : "";
    return `<div class="line ${f.level}"><span class="d"></span><span class="t">${esc(f.text)}</span>${button}</div>`;
  });
  const prof = pf("Game engine", pr.game) + pf("3D print", pr.print);
  return `<div class="obj"><h4>${esc(o.name)}</h4><div class="prof">${prof}</div>${lines.join("")}</div>`;
}

/** the selected objects, or with nothing selected every visible one */
export function openReport(d: BuildWindowDeps): void {
  const objs = d.store.selected().length ? d.store.selected() : d.store.visibleObjects();
  const body = $("#report-body");
  const picks: (() => void)[] = [];
  const intro = `<div class="note">Checked ${objs.length} ${objs.length === 1 ? "object" : "objects"}. Click a problem to select it.</div>`;
  body.innerHTML = intro + objs.map((o) => objectCard(o, picks, d)).join("");
  body.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-pick]");
    if (b) picks[+b.dataset.pick!]();
  };
  showWindow("report", true);
}
