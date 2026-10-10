/** The window inside a room: its name and code, host controls, and who is here. */
import { esc } from "@/ui/dom";
import type { PeerState } from "@/net/state";
import { identityRow } from "./lobby-view";
import type { Me, RoomSession } from "./port";

const hostTag = (id: string, hostId: string) => (id && id === hostId ? ` <em class="host-tag">host</em>` : "");

const person = (color: string, name: string, extra = "") =>
  `<li><span class="dot" style="background:${color}"></span><span class="pn">${name}</span>${extra}</li>`;

function kickButton(p: PeerState): string {
  const who = esc(p.name || "this person");
  return `<button class="btn small kick" data-kick="${esc(p.id)}" data-name="${who}"
    title="Remove from the room">Remove</button>`;
}

function peopleList(me: Me, session: RoomSession): string {
  const hostId = session.hostId();
  const amHost = session.amHost();
  const self = person(me.look.shirt, `${esc(me.name)} <i>(you)</i>${hostTag(session.net.selfId, hostId)}`);
  const others = [...session.net.peers.values()].map((p) => {
    const name = esc(p.name || "Connecting…") + (p.synced ? "" : " <i>(joining)</i>") + hostTag(p.id, hostId);
    return person(p.color, name, amHost ? kickButton(p) : "");
  });
  return self + others.join("");
}

function hostBox(session: RoomSession): string {
  if (session.amHost()) {
    const rules = session.net.rules;
    const everyone = !rules || rules.build === "all" ? "checked" : "";
    return `<div class="mp-host"><b>You are the host</b>
      <label class="check"><input type="checkbox" id="mp-build-all" ${everyone}>Everyone can build</label>
      <span class="note">Unchecked: only you can change the scene; others can still walk, chat and use scripted
        things.</span></div>`;
  }
  if (!session.canIBuild()) {
    return `<div class="mp-host locked"><b>Only the host can build here.</b>
      <span class="note">You can walk around, chat and use scripted things.</span></div>`;
  }
  return "";
}

function roomHead(session: RoomSession): string {
  const net = session.net;
  // a room can only be listed once we have its scene to offer
  const listed = net.isPublic ? "checked" : "";
  const listBox = net.synced
    ? `<label class="check"><input type="checkbox" id="mp-list" ${listed}>Listed publicly</label>`
    : "";
  const status = net.synced ? "" : "getting the scene…";
  return `<div class="mp-head"><b>${esc(net.name)}</b><span class="note">${status}</span></div>
    <div class="mp-row">
      <span class="lbl">Code</span><code class="mp-code">${esc(net.id)}</code>
      <button class="btn small" id="mp-copy">Copy</button><button class="btn small" id="mp-leave">Leave</button>
    </div>
    ${listBox}`;
}

export function roomHTML(me: Me, session: RoomSession, connection: string): string {
  return `${identityRow(me)}
    ${roomHead(session)}
    ${hostBox(session)}
    <h4>Here now <span>${session.net.peers.size + 1}</span></h4>
    <ul class="mp-people">${peopleList(me, session)}</ul>
    <p class="note">Chat at the bottom left of the view (Enter).</p>
    ${connection}`;
}
