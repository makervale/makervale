import type { Bus } from "@/app/bus";
import type { ChatLine } from "@/net/state";

/** what the chat needs from the room session (old net/session.ts) and your avatar (old viewport/avatar.ts) */
export interface ChatDeps {
  bus: Bus;
  /** the room's state; `chat` is replaced by a new array when you leave a room */
  net: { readonly chat: readonly ChatLine[] };
  session: { say(text: string): void };
  avatar: { talked(text: string): void };
  /** where the overlay goes; #stage by default */
  stage?: HTMLElement;
}
