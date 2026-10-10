/** The window outside rooms: open one, your saved rooms, join with a code, the public list. */
import { esc } from "@/ui/dom";
import type { Me } from "./port";

export function identityRow(me: Me): string {
  return `<div class="mp-row">
    <span class="lbl">You are</span><b class="mp-me">${esc(me.name)}</b>
    <button class="btn small" id="mp-avatar">Avatar…</button>
  </div>`;
}

function openRoom(me: Me): string {
  const roomName = esc(me.name.split(" ")[0] + "'s place");
  return `<h4>Open a room</h4>
    <div class="mp-row">
      <input class="tf" id="mp-room" maxlength="60" placeholder="Room name" value="${roomName}">
      <button class="btn primary" id="mp-host">Open</button>
    </div>
    <label class="check"><input type="checkbox" id="mp-public">List it publicly (anyone can join)</label>
    <p class="note">Unlisted, only people you give the code to can join: the safe default.</p>
    <p class="note">Your current scene becomes the room's scene. People who join can walk around, build and script
      with you. Everyone keeps a copy, so the room lives on without a server.</p>`;
}

export function lobbyHTML(me: Me, connection: string): string {
  return `${identityRow(me)}
    ${openRoom(me)}
    <h4>My rooms <span>saved in this browser</span></h4>
    <div class="mp-rooms" id="mp-mine"></div>
    <h4>Join with a code</h4>
    <div class="mp-row">
      <input class="tf" id="mp-code" maxlength="40" placeholder="Room code">
      <button class="btn" id="mp-join">Join</button>
    </div>
    <h4>Public rooms <span id="mp-status"></span></h4>
    <p class="note mp-warn">Strangers' rooms, unmoderated: whoever is inside gets your IP address and can say or
      show anything. Safest is to join only rooms of people you know.</p>
    <div class="mp-rooms" id="mp-rooms"></div>
    <p class="note">Rooms are announced on public Nostr relays; nobody keeps a server for this. The scene itself
      travels directly between browsers.</p>
    ${connection}`;
}
