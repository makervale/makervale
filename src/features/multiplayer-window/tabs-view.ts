/** The window's four tabs. Inside a room the first one is "This room". */
import type { MpTab } from "./state";

const TABS: { id: MpTab; label: string }[] = [
  { id: "rooms", label: "Rooms" },
  { id: "public", label: "Public" },
  { id: "gallery", label: "Gallery" },
  { id: "settings", label: "Settings" },
];

export function tabsHTML(active: MpTab, inRoom: boolean): string {
  const tabs = TABS.map(({ id, label }) => {
    const text = id === "rooms" && inRoom ? "This room" : label;
    return `<button class="mp-tab ${id === active ? "on" : ""}" data-tab="${id}">${text}</button>`;
  });
  return `<nav class="mp-tabs" role="tablist">${tabs.join("")}</nav>`;
}
