/** The Public tab: rooms open to anyone right now, each with its owner in it. */
import { esc } from "@/ui/dom";
import { fillWord, people, relayStatusText } from "./format";
import type { PublicRoom, RelayStatus } from "./port";

function row(r: PublicRoom, hereId: string): string {
  const build = r.open ? "guests build" : "guests watch";
  const action =
    r.code === hereId
      ? `<span class="note">You're here</span>`
      : `<button class="btn small" data-join-public="${esc(r.code)}" data-name="${esc(r.name)}">Join</button>`;
  const weight = fillWord(r.fill);
  return `<div class="mp-item"><div class="mp-item-t"><b><span class="live-dot"></span>${esc(r.name)}</b>
      <span>${esc(r.owner)} · ${people(r.people)} · ${build}${weight ? " · " + weight : ""}</span></div>
    <div class="mp-item-a">${action}</div></div>`;
}

function empty(s: RelayStatus): string {
  if (s.reachable) return "No public rooms right now. Start one under Rooms.";
  if (!s.probing && !s.total) return "Can't reach any public relay from here.";
  return "Looking for rooms…";
}

/** `hereId`: the room this tab is in ("" if none), listed without a Join */
export function publicHTML(rooms: PublicRoom[], status: RelayStatus, hereId: string): string {
  const list = rooms.length
    ? `<div class="mp-items">${rooms.map((r) => row(r, hereId)).join("")}</div>`
    : `<p class="note">${empty(status)}</p>`;
  return `<p class="note">Strangers' rooms. The owner of each is in it right now, and everyone there sees your IP
      address. Leave whenever you like.</p>
    <h4>Open now <span>${relayStatusText(status)}</span></h4>${list}`;
}
