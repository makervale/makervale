/** Script editing: live syntax check, apply (Ctrl+Enter), remove, templates, Tab indents, open from elsewhere. */
import { TEMPLATES } from "./script-templates";
import { toast } from "@/ui/toast";
import { showWindow } from "@/ui/window";
import type { Build, Clicks, Field } from "./context";
import { editor, scriptConsole, scriptStatus, syntaxError } from "./script-status";

const CHECK_AFTER_MS = 250;
const INDENT = "  ";

export function applyScript(b: Build, remove = false): void {
  const o = b.deps.store.byId(b.scriptFor);
  const area = editor(b);
  if (!o || !area) return;
  const text = remove ? "" : area.value.replace(/\s+$/, "") + "\n";
  const error = remove ? "" : syntaxError(text);
  if (error) {
    scriptStatus(b, o.id);
    toast("Not applied: " + error);
    return;
  }
  b.deps.commands.act(remove ? "Remove script" : "Script", [o.id], () => {
    delete o.scriptState;
    if (text.trim()) o.script = text;
    else {
      delete o.script;
      delete o.spin;
    }
  });
  b.scriptFor = "";
  b.deps.scripts.restartScript(o.id);
  b.renderTab();
}

function onKey(b: Build, e: KeyboardEvent): void {
  const t = e.target as HTMLTextAreaElement;
  if (t.id !== "sc-src") return;
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    applyScript(b);
  } else if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    t.setRangeText(INDENT, t.selectionStart, t.selectionEnd, "end");
    scriptStatus(b, b.scriptFor);
  }
}

export function wireScriptEditor(b: Build): void {
  let timer = 0;
  b.root.addEventListener("keydown", (e) => onKey(b, e));
  b.root.addEventListener("input", (e) => {
    if ((e.target as HTMLElement).id !== "sc-src") return;
    clearTimeout(timer);
    timer = window.setTimeout(() => scriptStatus(b, b.scriptFor), CHECK_AFTER_MS);
  });
  b.deps.bus.on("scripts:errors", () => {
    if (b.tab === "script" && b.scriptFor) scriptStatus(b, b.scriptFor);
  });
  b.deps.bus.on("scripts:output", ({ id }) => {
    if (b.tab === "script" && b.scriptFor === id) scriptConsole(b, id);
  });
  b.deps.bus.on("script:open", ({ id }) => openScript(b, id));
}

/** a template replaces the editor's text and applies at once */
export function onTemplateChange(b: Build, t: Field): boolean {
  if (t.id !== "sc-tpl") return false;
  const template = TEMPLATES.find((x) => x.id === t.value);
  const area = editor(b);
  if (template && area) {
    area.value = template.src;
    applyScript(b);
  }
  return true;
}

/** open the Script tab on an object (pie menu): selects it alone first */
export function openScript(b: Build, id: string): void {
  const { store, commands } = b.deps;
  if (!store.byId(id)) return;
  showWindow("build", true);
  const sel = store.selection;
  if (!sel.objects.has(id) || sel.objects.size !== 1) {
    commands.selectObjects([id]);
    commands.setMode("object");
  }
  b.tab = "script";
  b.scriptFor = "";
  b.renderTab();
  editor(b)?.focus();
}

export const SCRIPT_CLICKS: Clicks = [
  ["#sc-apply", (b) => applyScript(b)],
  ["#sc-remove", (b) => applyScript(b, true)],
];
