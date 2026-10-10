/** The Script tab's status line: syntax error, "not applied yet", the runtime's error, or what the script does. */
import { parse } from "@/lib/script";
import type { Obj } from "@/world/model";
import type { Build } from "./context";

export const editor = (b: Build): HTMLTextAreaElement | null => b.root.querySelector<HTMLTextAreaElement>("#sc-src");

export function syntaxError(text: string): string {
  try {
    if (text.trim()) parse(text);
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function runningText(b: Build, o: Obj): string {
  if (!o.script) return "No script yet. Pick a template or write one.";
  return b.deps.scripts.touchable(o) ? "Running. Click the object to touch it." : "Running.";
}

/** syntax first, then "not applied yet", then the runtime's error, then what it does */
export function scriptStatus(b: Build, id: string): void {
  const el = b.root.querySelector<HTMLElement>("#sc-status");
  const o = b.deps.store.byId(id);
  if (!el || !o) return;
  const area = editor(b);
  const text = area ? area.value : o.script || "";
  const syntax = syntaxError(text);
  const runtime = b.deps.scripts.scriptError(id);
  const edited = !!area && text !== (o.script || "");
  el.className = "sc-status " + (syntax || runtime ? "bad" : "ok");
  if (syntax) el.textContent = syntax;
  else if (edited) el.textContent = "Not applied yet (Ctrl+Enter)";
  else el.textContent = runtime || runningText(b, o);
}
