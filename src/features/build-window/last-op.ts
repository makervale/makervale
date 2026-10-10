/** The last-operation panel: change a tool's parameters after it ran and watch the result update. */
import type { Entry } from "@/world/history";
import { $, esc } from "@/ui/dom";
import { onSpin, spinner } from "@/ui/spinner";
import type { Build, Clicks, Field } from "./context";

/** while a spinner is held, re-run at most this often */
const RERUN_EVERY_MS = 40;

const panel = (b: Build): HTMLElement => $("#b-last", b.root);

export function hideLastOp(b: Build): void {
  panel(b).hidden = true;
}

export function showLastOp(b: Build, entry: Entry): void {
  b.lastEntry = entry;
  const el = panel(b);
  const t = entry.tool && b.deps.runner.tools.get(entry.tool.id);
  if (!t?.params?.length) {
    el.hidden = true;
    return;
  }
  const values = entry.tool!.params as Record<string, number>;
  const rows = t.params.map((d) => {
    if (d.options) {
      const opts = d.options.map(
        (o, i) => `<option value="${i}" ${values[d.key] === i ? "selected" : ""}>${esc(o)}</option>`,
      );
      return `<div class="prow"><span class="pl">${esc(d.label)}</span><select class="cb" data-lastopt="${d.key}">${opts.join("")}</select></div>`;
    }
    const spin = spinner("last:" + d.key, "", values[d.key], {
      min: d.min,
      max: d.max,
      step: d.step,
      decimals: d.decimals ?? 2,
      aria: d.label,
    });
    return `<div class="prow"><span class="pl">${esc(d.label)}${d.unit ? ` (${esc(d.unit)})` : ""}</span>${spin}</div>`;
  });
  const head = `<div class="h"><b>${esc(t.name)}</b><span class="note">change and watch</span><button data-last-close title="Close">✕</button></div>`;
  el.innerHTML = head + rows.join("");
  el.hidden = false;
}

/** re-run only while the panel's entry is still the newest: anything done since would be lost */
function rerun(b: Build, changes: Record<string, number>): void {
  if (b.lastEntry && b.deps.commands.history.last() === b.lastEntry) b.deps.runner.rerunLast(changes);
}

export function wireLastOp(b: Build): void {
  let timer = 0;
  onSpin("last", (key, v, phase) => {
    if (phase === "start") return;
    const changes = { [key.split(":")[1]]: v };
    clearTimeout(timer);
    if (phase === "end") rerun(b, changes);
    else timer = window.setTimeout(() => rerun(b, changes), RERUN_EVERY_MS);
  });
  const { bus, commands } = b.deps;
  bus.on("tool:ran", ({ entry }) => showLastOp(b, entry));
  // a re-run replaces the entry: stay bound to the new one; undo, redo or another action closes the panel
  bus.on("history:changed", ({ entry }) => {
    const last = commands.history.last();
    if (!b.lastEntry || last === b.lastEntry) return;
    if (entry && entry === last && entry.tool?.id === b.lastEntry.tool?.id) b.lastEntry = entry;
    else hideLastOp(b);
  });
  bus.on("room:joined", () => hideLastOp(b));
  bus.on("room:left", () => hideLastOp(b));
}

export function onLastOptChange(b: Build, t: Field): boolean {
  if (!t.dataset.lastopt) return false;
  rerun(b, { [t.dataset.lastopt]: +t.value });
  return true;
}

export const LAST_OP_CLICKS: Clicks = [["[data-last-close]", (b) => hideLastOp(b)]];
