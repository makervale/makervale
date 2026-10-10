/** The short message at the bottom of the stage, optionally with one action button. */
import { el } from "./dom";

export interface ToastAction {
  label: string;
  run: () => void;
  /** how long it stays up, ms (longer messages need longer to read) */
  holdMs?: number;
}

const SHOW_MS = 2400;
const SHOW_WITH_ACTION_MS = 4500;

let timer = 0;

export function toast(message: string, action?: ToastAction): void {
  const box = toastBox();
  box.textContent = message;
  if (action) box.appendChild(actionButton(box, action));
  box.hidden = false;
  clearTimeout(timer);
  timer = window.setTimeout(() => (box.hidden = true), action ? (action.holdMs ?? SHOW_WITH_ACTION_MS) : SHOW_MS);
}

function toastBox(): HTMLElement {
  const stage = document.getElementById("stage") ?? document.body;
  let box = stage.querySelector<HTMLElement>(".toast");
  if (box) return box;
  box = el("div", "toast");
  box.setAttribute("role", "status");
  stage.appendChild(box);
  return box;
}

function actionButton(box: HTMLElement, action: ToastAction): HTMLButtonElement {
  const b = el("button", "btn small", action.label);
  b.onclick = () => {
    action.run();
    box.hidden = true;
  };
  return b;
}
