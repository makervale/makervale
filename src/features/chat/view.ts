/** The chat overlay's markup: recent lines above a line to type in, bottom left of the view. */
import type { ChatLine } from "@/net/state";
import { el } from "@/ui/dom";
import { lineKind } from "./lines";

const TEMPLATE = `<div class="chat" id="chat">
  <div class="chat-log" id="chat-log" aria-live="polite"></div>
  <input class="chat-say" id="chat-say" maxlength="500" placeholder="Say something (Enter)" aria-label="Chat"
    autocomplete="off">
</div>`;

export interface ChatView {
  box: HTMLElement;
  log: HTMLElement;
  input: HTMLInputElement;
}

export function createChatView(stage: HTMLElement): ChatView {
  stage.insertAdjacentHTML("beforeend", TEMPLATE);
  const box = stage.querySelector<HTMLElement>("#chat")!;
  return {
    box,
    log: box.querySelector<HTMLElement>("#chat-log")!,
    input: box.querySelector<HTMLInputElement>("#chat-say")!,
  };
}

/** one line; system lines have no speaker */
export function lineElement(line: ChatLine): HTMLElement {
  const d = el("div", "cl " + lineKind(line));
  d.dataset.at = String(line.at);
  if (!line.system) d.appendChild(el("b", "", line.name + ": "));
  d.appendChild(document.createTextNode(line.text));
  return d;
}
