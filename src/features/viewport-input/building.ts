/** Leaving building, and the bottom bar's Fly / Land / Stand button. */
import { onWindowToggled } from "@/ui/window";
import type { InputCtx } from "./state";

/** closing the Build window leaves building: the tool is kept and the selection goes */
export function leaveBuildingOnClose(ctx: InputCtx): void {
  onWindowToggled((id, open) => {
    if (id !== "build" || open) return;
    ctx.live.confirm();
    ctx.commands.setToolMode("edit");
    ctx.commands.clearSelection();
  });
}

function buttonLabel(sitting: boolean, flying: boolean): string {
  if (sitting) return "Stand";
  return flying ? "Land" : "Fly";
}

export function wireAvatarButton(ctx: InputCtx): void {
  const button = document.getElementById("av-btn");
  if (!button) return;
  const { avatar } = ctx;
  const label = () => {
    const text = button.querySelector("span");
    if (text) text.textContent = buttonLabel(avatar.sitting, avatar.flying);
    button.setAttribute("aria-pressed", String(avatar.flying));
  };
  button.addEventListener("click", () => {
    if (avatar.sitting) avatar.standUp();
    else avatar.setFlying(!avatar.flying);
    ctx.canvas.focus();
  });
  ctx.bus.on("avatar:changed", label);
  label();
}
