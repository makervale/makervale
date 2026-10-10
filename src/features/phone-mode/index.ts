/**
 * Phones get a lighter Makervale: walk, look, chat, join rooms and click things. Building needs a mouse and a big
 * screen, so Build, Tools and Camera stay visible (people should see they exist) but explain instead of opening.
 * Sets `html.phone`, which mobile.css uses for the phone layout, and says up front how limited the phone is.
 */
import { DESKTOP_ONLY_MESSAGE, PHONE_QUERY, isPhone } from "@/ui/device";
import { $$ } from "@/ui/dom";
import { toast } from "@/ui/toast";
import { onWindowToggled, showWindow } from "@/ui/window";
import { showPhoneNotice } from "./notice";

const DESKTOP_ONLY = "[data-win='build'], [data-cat-toggle], [data-win='camfl']";
/** windows that need a mouse and a big screen */
const DESKTOP_WINDOWS = new Set(["build", "camfl"]);

export function mount(): void {
  const media = matchMedia(PHONE_QUERY);
  const apply = () => {
    document.documentElement.classList.toggle("phone", media.matches);
    if (!media.matches) return;
    for (const id of DESKTOP_WINDOWS) showWindow(id, false);
    showPhoneNotice();
  };
  media.addEventListener("change", apply);
  apply();
  for (const b of $$(DESKTOP_ONLY)) b.classList.add("desktop-only");
  // capture phase: runs before the buttons' own handlers, which then never see the press
  document.addEventListener("click", blockDesktopOnly, true);
  // anything else that opens these windows (a menu, a tool, a shortcut) is turned back here
  onWindowToggled((id, open) => {
    if (!DESKTOP_WINDOWS.has(id) || !open || !isPhone()) return;
    showWindow(id, false);
    toast(DESKTOP_ONLY_MESSAGE);
  });
}

function blockDesktopOnly(e: MouseEvent): void {
  if (!isPhone() || !(e.target as HTMLElement).closest(DESKTOP_ONLY)) return;
  e.preventDefault();
  e.stopPropagation();
  toast(DESKTOP_ONLY_MESSAGE);
}
