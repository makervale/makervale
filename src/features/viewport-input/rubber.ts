/** The dashed rectangle of a box selection. */
import type { Rect } from "@/render/pick-rect";

export class Rubber {
  private readonly el: HTMLElement;

  constructor(private readonly stage: HTMLElement) {
    const existing = document.getElementById("rubber");
    this.el = existing ?? stage.appendChild(document.createElement("div"));
    this.el.className = "rubber";
    this.el.id = "rubber";
  }

  show(r: Rect): void {
    const s = this.stage.getBoundingClientRect();
    Object.assign(this.el.style, {
      display: "block",
      left: r.x0 - s.left + "px",
      top: r.y0 - s.top + "px",
      width: r.x1 - r.x0 + "px",
      height: r.y1 - r.y0 + "px",
    });
  }

  hide(): void {
    this.el.style.display = "none";
  }
}

/** the rectangle between two corners */
export const rectBetween = (ax: number, ay: number, bx: number, by: number): Rect => ({
  x0: Math.min(ax, bx),
  y0: Math.min(ay, by),
  x1: Math.max(ax, bx),
  y1: Math.max(ay, by),
});
