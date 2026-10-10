/**
 * Chat: a line to type in at the bottom left of the view, with recent lines above it that fade
 * after a while (hover or type to see them all again). Works alone too: scripted objects can hear you and talk back.
 */
import type { ChatLine } from "@/net/state";
import { isOld, MAX_SHOWN, unseenLines } from "./lines";
import type { ChatDeps } from "./port";
import type { ChatView } from "./view";
import { createChatView, lineElement } from "./view";

export type { ChatDeps } from "./port";

const FADE_CHECK_MS = 2000;
/** how long the CSS takes to fold an old line away */
const FOLD_MS = 700;

export function mount(deps: ChatDeps): void {
  const stage = deps.stage ?? document.getElementById("stage") ?? document.body;
  const view = createChatView(stage);
  let lastShown: ChatLine | null = null;
  const render = () => {
    lastShown = renderLines(view, deps.net.chat, lastShown);
  };
  wireInput(view, deps);
  deps.bus.on("chat:message", render);
  deps.bus.on("room:changed", render);
  deps.bus.on("room:joined", render);
  deps.bus.on("room:left", render);
  deps.bus.on("chat:focus", () => view.input.focus());
  render();
  setInterval(() => fade(view.log), FADE_CHECK_MS);
}

function wireInput(view: ChatView, deps: ChatDeps): void {
  const { box, input, log } = view;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const text = input.value.trim();
      if (text) deps.session.say(text);
      input.value = "";
    } else if (e.key === "Escape") {
      e.preventDefault();
      input.value = "";
      input.blur();
      document.getElementById("view")?.focus();
    }
  });
  // while you type, your avatar gestures as if talking
  input.addEventListener("input", () => {
    if (input.value) deps.avatar.talked("…");
  });
  input.addEventListener("focus", () => {
    box.classList.add("open");
    toNewest(log);
  });
  input.addEventListener("blur", () => box.classList.remove("open"));
  box.addEventListener("mouseenter", () => toNewest(log));
}

/** the history opens at the newest lines (the older ones only just unfolded above them) */
function toNewest(log: HTMLElement): void {
  requestAnimationFrame(() => (log.scrollTop = log.scrollHeight));
}

/** append what is new; returns the last line now shown */
function renderLines(view: ChatView, chat: readonly ChatLine[], lastShown: ChatLine | null): ChatLine | null {
  const { log } = view;
  const { reset, lines } = unseenLines(chat, lastShown);
  if (reset) log.textContent = "";
  for (const line of lines) log.appendChild(lineElement(line));
  while (log.children.length > MAX_SHOWN) log.firstChild!.remove();
  log.scrollTop = log.scrollHeight;
  fade(log);
  return chat.length ? chat[chat.length - 1] : null;
}

function fade(log: HTMLElement): void {
  const now = Date.now();
  for (const d of log.children as HTMLCollectionOf<HTMLElement>)
    d.classList.toggle("old", isOld(Number(d.dataset.at ?? 0), now));
  // the top only fades when a line is actually cut through there (checked again once the fold-away has run)
  const over = () => log.classList.toggle("over", log.scrollHeight > log.clientHeight + 1);
  over();
  setTimeout(over, FOLD_MS);
}
