/** Wire every message of a new room connection to its handler. */
import type { Ctx } from "../context";
import { onAsk } from "../moderation/ask";
import { onVaultSnap } from "../room-copies";
import type { Transport } from "../transport";
import { onAvatar, onGesture } from "./avatars";
import { onBodies } from "./bodies";
import { onChat, onObjectSay } from "./chat";
import { onDrag } from "./drag";
import { onHello } from "./hello";
import { onObjs } from "./objects";
import { onFx, onNote, onTouch } from "./scripts";
import { onSnap } from "./snapshot";

export function listenAll(ctx: Ctx, link: Transport): void {
  link.on("hello", (d, from) => onHello(ctx, d, from));
  link.on("snap", (d) => onSnap(ctx, d));
  link.on("vsnap", (_d, from) => void onVaultSnap(ctx, from));
  link.on("ask", (_d, from) => onAsk(ctx, from));
  link.on("objs", (d, from) => onObjs(ctx, d, from));
  link.on("xf", (d, from) => onDrag(ctx, d, from));
  link.on("av", (d, from) => onAvatar(ctx, d, from));
  link.on("chat", (d, from) => onChat(ctx, d, from));
  link.on("fx", (d, from) => onFx(ctx, d, from));
  link.on("tch", (d, from) => onTouch(ctx, d, from));
  link.on("osay", (d, from) => onObjectSay(ctx, d, from));
  link.on("gest", (d, from) => onGesture(ctx, d, from));
  link.on("body", (d, from) => onBodies(ctx, d, from));
  link.on("note", (d, from) => onNote(ctx, d, from));
}
