/**
 * Edits driven by a spinner: the view follows every step, and the whole drag becomes one undo entry.
 * During the drag the objects change in place, like a handle drag; at the end they go back to where they started
 * and the final state is applied once through `commands.act`, so history sees one clean before/after.
 */
import type { SpinPhase } from "@/ui/spinner";
import type { Obj } from "@/world/model";
import { cloneObj } from "@/world/model";
import type { BuildWindowDeps } from "./deps";

export interface DragStep {
  label: string;
  objs: Obj[];
  phase: SpinPhase;
  /** set the value; must give the same result when run again on the result */
  apply: () => void;
  /** the change moves vertices, so geometry is rebuilt as it goes */
  mesh?: boolean;
}

/** put the fields of `from` back on `o`, keeping `o` the same object (others hold it) */
const restore = (o: Obj, from: Obj): void => void Object.assign(o, from);

export class DragEdit {
  private start: Map<string, Obj> | null = null;

  constructor(private readonly deps: Pick<BuildWindowDeps, "commands" | "renderer">) {}

  step(s: DragStep): void {
    if (s.phase === "start" || !this.start) this.start = new Map(s.objs.map((o) => [o.id, cloneObj(o)]));
    if (s.phase === "start") return;
    s.apply();
    if (s.phase === "live") this.preview(s);
    else this.commit(s);
  }

  private preview(s: DragStep): void {
    const { commands, renderer } = this.deps;
    for (const o of s.objs) {
      if (s.mesh) commands.meshChanged(o);
      renderer.views.sync(o);
    }
    commands.dragging(s.objs.map((o) => o.id));
    renderer.highlights.refresh();
  }

  private commit(s: DragStep): void {
    const start = this.start!;
    this.start = null;
    const finals = s.objs.map(cloneObj);
    for (const o of s.objs) {
      const before = start.get(o.id);
      if (before) restore(o, before);
    }
    this.deps.commands.act(
      s.label,
      s.objs.map((o) => o.id),
      () => s.objs.forEach((o, i) => restore(o, finals[i])),
    );
  }
}
