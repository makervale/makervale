/** The Rooms tab outside rooms: an invitation (if a link brought you), start a room, join one, your rooms. */
import { esc } from "@/ui/dom";
import { displayCode } from "@/net";
import { ago, objects } from "./format";
import type { Me, SavedRoomInfo } from "./port";

export const KIND_TEXT = {
  private:
    "Only people you give the link to can come in. Everyone builds with you, and the room carries on when you leave.",
  public:
    "Anyone can find it under Public and join while you are in it. Guests watch until you let them build. It closes when you leave.",
};

export function inviteHTML(code: string): string {
  return `<div class="mp-card mp-invite">
    <b>You're invited to a room</b>
    <span class="note">Room <code>${esc(displayCode(code))}</code>. Your own scene waits aside until you leave.</span>
    <div class="mp-actions"><button class="btn primary" id="mp-invite-join">Join</button>
      <button class="btn" id="mp-invite-no">Not now</button></div></div>`;
}

function startHTML(me: Me): string {
  const name = esc(me.name.split(" ")[0] + "'s place");
  return `<div class="mp-card">
    <b>Start a room</b>
    <input class="tf" id="mp-room-name" maxlength="60" value="${name}" aria-label="Room name">
    <div class="mp-seg" role="radiogroup">
      <label><input type="radio" name="mp-kind" value="private" checked><span>Private</span></label>
      <label><input type="radio" name="mp-kind" value="public"><span>Public</span></label>
    </div>
    <span class="note" id="mp-kind-text">${KIND_TEXT.private}</span>
    <div class="mp-actions"><button class="btn primary" id="mp-start">Start with my scene</button></div></div>`;
}

const JOIN = `<div class="mp-card">
    <b>Join a room</b>
    <div class="mp-row"><input class="tf" id="mp-code" maxlength="200" placeholder="Paste a link or type a code"
      aria-label="Link or code"><button class="btn" id="mp-join">Join</button></div></div>`;

function savedRoomRow(r: SavedRoomInfo): string {
  const kind = r.kind === "public" ? "Public" : "Private";
  const facts = [kind, objects(r.objects), ago(r.savedAt)];
  if (r.keep) facts.push("kept online");
  const origin = r.basedOn ? `<span class="note">Copy of ${esc(r.basedOn.title)} ${esc(r.basedOn.version)}</span>` : "";
  const remove = r.owned
    ? `<button class="btn small quiet" data-delete="${esc(r.id)}" data-name="${esc(r.name)}">Delete</button>`
    : `<button class="btn small quiet" data-forget="${esc(r.id)}">Remove</button>`;
  return `<div class="mp-item"><div class="mp-item-t"><b>${esc(r.name)}${r.owned ? "" : ` <i>· joined</i>`}</b>
      <span>${facts.join(" · ")}</span>${origin}</div>
    <div class="mp-item-a">${remove}<button class="btn small" data-reopen="${esc(r.id)}">Open</button></div></div>`;
}

function mineHTML(mine: SavedRoomInfo[]): string {
  if (!mine.length) return `<p class="note">Rooms you start or join appear here, so you can open them again later.</p>`;
  return `<div class="mp-items">${mine.map(savedRoomRow).join("")}</div>`;
}

export function roomsHTML(me: Me, mine: SavedRoomInfo[], invite: string | null): string {
  return `${invite ? inviteHTML(invite) : ""}${startHTML(me)}${JOIN}
    <h4>Your rooms</h4>${mineHTML(mine)}`;
}
