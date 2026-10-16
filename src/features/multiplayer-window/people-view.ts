/** Who is in the room. The owner can let each person build or not, and remove people. */
import { esc } from "@/ui/dom";
import type { PeerState, Session } from "./port";

const tag = (text: string, cls = "") => ` <em class="mp-tag ${cls}">${text}</em>`;

function ownerButtons(session: Session, p: PeerState): string {
  const name = esc(p.name || "this person");
  const builds = session.canBuild(p.id);
  const toggle = `<button class="btn small" data-let="${esc(p.id)}" data-yes="${builds ? "" : "1"}">${builds ? "Stop building" : "Let build"}</button>`;
  return `${toggle}<button class="btn small quiet" data-kick="${esc(p.id)}" data-name="${name}">Remove</button>`;
}

function tags(session: Session, p: PeerState): string {
  let out = "";
  if (p.id === session.ownerId()) out += tag("owner");
  else if (!session.canBuild(p.id)) out += tag("watching", "dim");
  if (!p.synced) out += tag("joining", "dim");
  if (session.routeOf(p.id) === "relay") out += tag("via relays", "dim");
  return out;
}

function personRow(color: string, name: string, extra = ""): string {
  return `<li><span class="dot" style="background:${color}"></span><span class="pn">${name}</span>${extra}</li>`;
}

export function peopleHTML(myName: string, myShirt: string, session: Session): string {
  const net = session.net;
  const mine = `${esc(myName)} <i>(you)</i>${net.selfId === session.ownerId() ? tag("owner") : ""}`;
  const others = [...net.peers.values()].map((p) => {
    const actions = session.amOwner() ? `<span class="mp-item-a">${ownerButtons(session, p)}</span>` : "";
    return personRow(p.color, esc(p.name || "Connecting…") + tags(session, p), actions);
  });
  return `<ul class="mp-people">${personRow(myShirt, mine)}${others.join("")}</ul>`;
}
