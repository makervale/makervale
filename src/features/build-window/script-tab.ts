/** Script tab: the selected object's script in an editor, templates, status, and a short language reference. */
import { TEMPLATES } from "@/lib/script";
import type { Obj } from "@/world/model";
import { esc } from "@/ui/dom";
import type { Build } from "./context";
import { scriptStatus } from "./script-status";

const PLACEHOLDER = "// for example:\non touch {\n  say &quot;Hello, &quot; + who\n  turn 0, 0, 45 in 0.5\n}";

const HELP = `<details class="sc-help"><summary>What can a script do?</summary><div>
      <p><b>Events</b>: <code>on start</code>, <code>on touch</code> (someone clicks it), <code>on timer 2</code>, <code>on near 3</code> (someone within 3 m), <code>on hear "word"</code> (chat), <code>on bump</code> (a ball hit it; <code>who</code> is the other object's name).</p>
      <p><b>Actions</b>: <code>move x, y, z in s</code>, <code>turn x, y, z in s</code> (degrees), <code>grow k in s</code>, <code>home in s</code>, <code>pivot x, y, z</code> (−0.5…0.5, the point it turns around), <code>spin x, y, z</code> (degrees per second), <code>color "#ff8800"</code>, <code>glow 0…1</code>, <code>opacity 0…1</code>, <code>show</code>, <code>hide</code>, <code>say "…"</code>, <code>timer s</code>, <code>play note, "marimba"</code> (semitones from middle C; also <code>"bell"</code>, <code>"pluck"</code>), <code>push x, y, z</code> (m/s, for a ball), <code>kick who, 7</code> (a ball, away from that person), <code>wait s</code>, <code>stop</code>.</p>
      <p><b>Logic</b>: <code>var n = 0</code>, <code>n += 1</code>, <code>if … { } else { }</code>, <code>repeat 3 { }</code>, <code>while … { }</code>, <code>and or not</code>. Built in: <code>who</code>, <code>heard</code>, <code>time</code>, <code>random(a, b)</code>, <code>round(x)</code>, <code>contains(a, b)</code>.</p>
      <p>Scripts only ever change their own object. In a room they run on one computer and everyone sees the result. A plain click on an object with <code>on touch</code> touches it; right-click it and choose Edit to select it.</p></div></details>`;

/** whose script to show: the selected object; with a group selected, the part that has a script, or the one clicked */
export function scriptTarget(objs: Obj[], last: string | null): Obj | null {
  if (objs.length === 1) return objs[0];
  const withScript = objs.filter((o) => o.script);
  if (withScript.length === 1) return withScript[0];
  return (last && objs.find((o) => o.id === last)) || null;
}

function editorHtml(one: Obj, count: number): string {
  const part =
    count > 1 ? `<div class="note">Script of <b>${esc(one.name)}</b>, part of a group of ${count}.</div>` : "";
  const templates = TEMPLATES.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  const remove = one.script ? '<button class="btn small" id="sc-remove">Remove</button>' : "";
  return `${part}<div class="sc-head"><select class="cb" id="sc-tpl" aria-label="Start from a template"><option value="">Templates…</option>${templates}</select><button class="btn small primary" id="sc-apply" title="Ctrl+Enter">Apply</button>${remove}</div>
    <textarea class="sc-src" id="sc-src" spellcheck="false" autocomplete="off" aria-label="Script for ${esc(one.name)}" placeholder="${PLACEHOLDER}">${esc(one.script || "")}</textarea>
    <div class="sc-status" id="sc-status"></div>
    ${HELP}`;
}

export function renderScriptTab(b: Build, el: HTMLElement, objs: Obj[]): void {
  const one = scriptTarget(objs, b.deps.store.selection.last);
  if (!one) {
    b.scriptFor = "";
    const why = objs.length
      ? "Scripts belong to one object: select just one."
      : "Select an object to give it a script.";
    el.innerHTML = `<div class="empty">${why}<br><br>Scripts make objects react: doors that open when clicked, lights, lifts, greeters.</div>`;
    return;
  }
  // the same object again: keep what is being typed, only refresh the status
  if (b.scriptFor === one.id && el.querySelector("#sc-src")) {
    scriptStatus(b, one.id);
    return;
  }
  b.scriptFor = one.id;
  el.innerHTML = editorHtml(one, objs.length);
  scriptStatus(b, one.id);
}
