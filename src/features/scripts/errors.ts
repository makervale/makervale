import type { Bus } from "@/app/bus";

/** The last error of each object's script. Panels read it; the user hears about each broken script once. */
export class ScriptErrors {
  private readonly errors = new Map<string, string>();
  private readonly told = new Set<string>();

  constructor(
    private readonly bus: Bus,
    private readonly tell: (id: string, message: string) => void,
  ) {}

  get(id: string): string {
    return this.errors.get(id) ?? "";
  }

  has(id: string): boolean {
    return this.errors.has(id);
  }

  ids(): string[] {
    return [...this.errors.keys()];
  }

  /** an empty message clears the error */
  set(id: string, message: string): void {
    if (this.get(id) === message) return;
    if (message) this.errors.set(id, message);
    else this.errors.delete(id);
    this.bus.emit("scripts:errors");
    // once per object, so a broken script is noticed even with the Build window closed
    if (message && !this.told.has(id)) {
      this.told.add(id);
      this.tell(id, message);
    }
  }
}
