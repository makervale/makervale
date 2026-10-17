/** What each script printed, and its errors: the last few lines per object, for the Script tab. */
import type { Bus } from "@/app/bus";

const KEEP_LINES = 50;
const MAX_LINE = 300;

export class ScriptConsole {
  private readonly lines = new Map<string, string[]>();
  private readonly changed = new Set<string>();

  constructor(private readonly bus: Bus) {}

  add(id: string, text: string): void {
    const lines = this.lines.get(id) ?? [];
    lines.push(text.length > MAX_LINE ? text.slice(0, MAX_LINE) + "…" : text);
    if (lines.length > KEEP_LINES) lines.splice(0, lines.length - KEEP_LINES);
    this.lines.set(id, lines);
    this.changed.add(id);
  }

  get(id: string): string[] {
    return this.lines.get(id) ?? [];
  }

  clear(id: string): void {
    if (this.lines.delete(id)) this.changed.add(id);
  }

  /** once a frame: tell the Script tab whose output changed, however much was printed */
  flush(): void {
    for (const id of this.changed) this.bus.emit("scripts:output", { id });
    this.changed.clear();
  }
}
