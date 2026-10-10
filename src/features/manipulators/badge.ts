/** The little label next to the cursor while dragging or adjusting: the distance, the angle, the value. */
export class Badge {
  readonly el: HTMLElement;

  constructor(private readonly stage: HTMLElement) {
    // the page may already have one
    this.el = document.getElementById("badge") ?? stage.appendChild(document.createElement("div"));
    this.el.className = "badge";
    this.el.id = "badge";
  }

  /** `snap`: the value is on a ruler step (drawn in the snap colour) */
  show(x: number, y: number, text: string, snap: boolean): void {
    const r = this.stage.getBoundingClientRect();
    this.el.textContent = text;
    this.el.className = snap ? "badge snap" : "badge";
    this.el.style.left = x - r.left + "px";
    this.el.style.top = y - r.top + "px";
    this.el.style.display = "block";
  }

  hide(): void {
    this.el.style.display = "none";
  }
}
