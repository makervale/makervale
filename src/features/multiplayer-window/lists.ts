/** The two room lists outside rooms (public rooms and My rooms) and the relay status next to them. */
import { esc } from "@/ui/dom";
import { announcedAgo, noRoomsText, people, pingLabel, rankRooms, relayStatusText, savedAgo } from "./format";
import type { RoomAd, SavedRoomInfo } from "./port";
import type { MpWindow } from "./state";

/** rooms pinged per redraw; each answer is cached for two minutes by the reachability side */
const PROBE_FIRST = 12;

const part = (win: MpWindow, selector: string) => win.body.querySelector<HTMLElement>(selector);

export function renderStatus(win: MpWindow): void {
  const status = part(win, "#mp-status");
  if (status) status.textContent = relayStatusText(win.deps.lobby.relayStatus());
}

function publicRoomRow(win: MpWindow, r: RoomAd, now: number): string {
  const p = win.deps.reachability.probeResult(r.id);
  const dead = !!p && !p.ok;
  const info = [pingLabel(p), esc(r.host), people(r.people), `${r.objects} objects`, announcedAgo(r.at, now)].join(
    " · ",
  );
  const label = dead ? "Try" : "Join";
  const join = `<button class="btn small" data-join="${esc(r.id)}" data-name="${esc(r.name)}">${label}</button>`;
  return `<div class="mp-room ${dead ? "dead" : ""}"><div><b>${esc(r.name)}</b><span>${info}</span></div>${join}</div>`;
}

/** ping each listed room (at most every two minutes) and show what came back; reachable rooms first */
export function renderRooms(win: MpWindow): void {
  const list = part(win, "#mp-rooms");
  if (!list) return;
  const { rooms } = win.state;
  const { reachability, lobby } = win.deps;
  if (!rooms.length) {
    list.innerHTML = `<div class="note">${noRoomsText(lobby.relayStatus())}</div>`;
    return;
  }
  for (const r of rooms.slice(0, PROBE_FIRST)) {
    if (!reachability.probeResult(r.id)) void reachability.probe(r.id).then(() => renderRooms(win));
  }
  const now = Date.now();
  list.innerHTML = rankRooms(rooms, (id) => reachability.probeResult(id))
    .map((r) => publicRoomRow(win, r, now))
    .join("");
}

function savedRoomRow(r: SavedRoomInfo, now: number): string {
  const info = `${r.objects} objects · ${savedAgo(r.savedAt, now)}${r.pub ? " · public" : ""}`;
  const buttons =
    `<button class="btn small" data-reopen="${esc(r.id)}">Reopen</button>` +
    `<button class="btn small" data-forget="${esc(r.id)}" title="Delete your copy">Forget</button>`;
  return `<div class="mp-room"><div><b>${esc(r.name)}</b><span>${info}</span></div>${buttons}</div>`;
}

export function renderMine(win: MpWindow): void {
  const list = part(win, "#mp-mine");
  if (!list) return;
  const { mine } = win.state;
  if (!mine.length) {
    list.innerHTML = `<div class="note">Rooms you open or join are kept here, so you can reopen them even when nobody
      else is there.</div>`;
    return;
  }
  const now = Date.now();
  list.innerHTML = mine.map((r) => savedRoomRow(r, now)).join("");
}

export async function refreshMine(win: MpWindow): Promise<void> {
  win.state.mine = await win.deps.session.savedRooms();
  if (!win.deps.session.inRoom()) renderMine(win);
}

export function startBrowsing(win: MpWindow): void {
  if (win.state.stopBrowse || win.deps.session.inRoom() || !win.deps.lobby.networkAllowed()) return;
  win.state.stopBrowse = win.deps.lobby.browse((rooms) => {
    win.state.rooms = rooms;
    if (!win.deps.session.inRoom()) renderRooms(win);
  });
}

export function stopBrowsing(win: MpWindow): void {
  win.state.stopBrowse?.();
  win.state.stopBrowse = null;
}
