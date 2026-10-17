/** Script tab: the selected object's script in an editor, templates, status, and a short language reference. */
import { TEMPLATES } from "./script-templates";
import type { Obj } from "@/world/model";
import { esc } from "@/ui/dom";
import type { Build } from "./context";
import { scriptStatus } from "./script-status";

const PLACEHOLDER =
  "-- for example:\nfunction onTouch(player)\n  say(&quot;Hello, &quot; .. player)\n  turn(0, 0, 45, 0.5)\nend";
const HELP = `<details class="sc-help"><summary>What can a script do?</summary><div>
      <p><b>It's Lua</b>, as in Roblox, with <code>+=</code>, <code>continue</code> and <code>\`text {value}\`</code>. A script changes only its own object; it talks to others with <code>send</code>.</p>
      <p><b>Events</b>: write a function with one of these names. <code>onStart()</code>, <code>onTouch(player)</code> (a click), <code>onNear(player)</code> / <code>onAway(player)</code> (within <code>setReach(m)</code>, 3 m to begin with), <code>onEnter(player)</code> / <code>onLeave(player)</code> (standing on or in it), <code>onHear(player, text)</code> (chat), <code>onBump(other)</code> (a ball hit it), <code>onBlocked()</code> (a move didn't fit: the space is too full), <code>onMessage(from, …)</code>.</p>
      <p><b>The object</b>: <code>move(x, y, z, s)</code>, <code>turn(x, y, z, s)</code> (degrees), <code>grow(k, s)</code>, <code>home(s)</code>, <code>pivot(x, y, z)</code> (−0.5…0.5), <code>spin(x, y, z)</code> (degrees a second), <code>color("#ff8800")</code>, <code>glow(0…1)</code>, <code>opacity(0…1)</code>, <code>show()</code>, <code>hide()</code>, <code>say(text)</code>, <code>label(text)</code> (stays above it; <code>label()</code> takes it away), <code>play(note, "marimba")</code> (also "bell", "pluck"), <code>push(x, y, z)</code>, <code>kick(player, speed)</code>. <code>me.name</code> is its name. A move waits until it's done; <code>s</code> is how long it takes.</p>
      <p><b>Time and others</b>: <code>wait(s)</code>, <code>every(s, function)</code>, <code>after(s, function)</code> (both give a number for <code>cancel(n)</code>), <code>now()</code>, <code>players()</code>, <code>distance(player)</code>, <code>send("Name", …)</code> (every object with that name hears <code>onMessage</code>).</p>
      <p><b>Keeping things</b>: what is in the table <code>state</code> is kept when another computer takes over the room. <code>print(…)</code> writes below the editor.</p></div></details>`;

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
    <pre class="sc-console" id="sc-console" hidden></pre>
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
