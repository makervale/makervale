/**
 * The Script tab's status line: syntax error, "not applied yet", the runtime's error, what the script just ran
 * into (resting, blocked), or what it does.
 */
import { parse } from "@/lib/script";
import type { Obj } from "@/world/model";
import type { Build } from "./context";

const NOTE_RECHECK_MS = 1000;
let recheck: ReturnType<typeof setTimeout> | undefined;

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

type Line = { kind: "ok" | "warn" | "bad"; text: string };

/** syntax first, then "not applied yet", then the runtime's error, then a note, then what it does */
function statusLine(b: Build, o: Obj): Line {
  const area = editor(b);
  const text = area ? area.value : o.script || "";
  const syntax = syntaxError(text);
  if (syntax) return { kind: "bad", text: syntax };
  if (area && text !== (o.script || "")) return { kind: "ok", text: "Not applied yet (Ctrl+Enter)" };
  const runtime = b.deps.scripts.scriptError(o.id);
  if (runtime) return { kind: "bad", text: runtime };
  const note = b.deps.scripts.scriptNote(o.id);
  return note ? { kind: "warn", text: note } : { kind: "ok", text: runningText(b, o) };
}

export function scriptStatus(b: Build, id: string): void {
  const el = b.root.querySelector<HTMLElement>("#sc-status");
  const o = b.deps.store.byId(id);
  if (!el || !o) return;
  const line = statusLine(b, o);
  el.className = "sc-status " + line.kind;
  el.textContent = line.text;
  // a note fades once the script stops running into it
  clearTimeout(recheck);
  if (line.kind === "warn") recheck = setTimeout(() => scriptStatus(b, id), NOTE_RECHECK_MS);
}
