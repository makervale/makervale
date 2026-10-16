/**
 * The window inside a room, top to bottom in the order people need it: what room this is and what's happening,
 * how to bring others, what you may do, the owner's settings, who is here, and the way out.
 */
import { esc } from "@/ui/dom";
import { displayCode } from "@/net";
import { people } from "./format";
import { ownerHTML, rulesSentence } from "./owner-view";
import { peopleHTML } from "./people-view";
import type { Session } from "./port";

const note = (bold: string, text = "") =>
  `<div class="mp-status"><b>${bold}</b>${text ? `<span class="note">${text}</span>` : ""}</div>`;

function waiting(session: Session): string {
  const net = session.net;
  if (net.peers.size) return note("Getting the scene…");
  if (net.rules?.kind === "public" || net.kind === "public")
    return note("Waiting for the owner…", "A public room opens only while its owner is in it.");
  if (net.vault.state === "loading") return note("Looking for the room…");
  return note(
    "Nobody is in this room right now",
    "It isn't kept online, so it opens as soon as someone who has it comes in. You can wait here or leave.",
  );
}

/** one sentence on what is going on, when there is something to know */
function statusHTML(session: Session): string {
  const net = session.net;
  if (!net.synced) return waiting(session);
  if (net.peers.size) return "";
  if (session.amOwner()) {
    return net.rules?.kind === "public"
      ? note("Your room is on the Public list", "Anyone can come in while you're here. They'll see your IP address.")
      : note("You're the only one here", "Copy the link below and send it to the people you want in.");
  }
  return note(
    "You're keeping this room open",
    "Nobody else is here, so the room runs on your computer. Whoever comes in with the link connects to you.",
  );
}

function shareHTML(session: Session): string {
  if (session.net.rules?.kind === "public" && !session.amOwner()) return "";
  return `<div class="mp-share"><button class="btn primary" id="mp-copy-link">Copy invite link</button>
    <span class="note">or the code <code class="mp-code" id="mp-copy-code" title="Click to copy">${esc(displayCode(session.net.id))}</code></span></div>`;
}

function meHTML(session: Session): string {
  if (session.amOwner() || !session.net.synced) return "";
  if (session.canIBuild()) return `<p class="mp-me-line">You can build here.</p>`;
  const wait = session.canAskAgainIn();
  const ask =
    session.ownerId() && session.net.peers.has(session.ownerId())
      ? `<button class="btn small" id="mp-ask" ${wait ? "disabled" : ""}>${wait ? "Asked" : "Ask to build"}</button>`
      : "";
  return `<div class="mp-row mp-me-line"><span>You're watching: walk, chat and play.</span>${ask}</div>`;
}

export function roomHTML(name: string, shirt: string, session: Session): string {
  const net = session.net;
  const kind = net.rules?.kind ?? net.kind;
  const count = net.synced ? people(net.peers.size + 1) : "";
  return `<div class="mp-head"><b>${esc(net.name)}</b><span class="mp-pill">${kind === "public" ? "Public" : "Private"}</span>
      <span class="note">${count}</span></div>
    ${statusHTML(session)}
    ${shareHTML(session)}
    ${session.amOwner() ? "" : `<p class="note">${rulesSentence(session)}</p>`}
    ${meHTML(session)}
    ${ownerHTML(session)}
    <h4>People here</h4>${peopleHTML(name, shirt, session)}
    <div class="mp-actions mp-end"><button class="btn" id="mp-copy-room" title="A private room of your own from this scene">Make a copy</button>
      <button class="btn" id="mp-leave">Leave</button></div>`;
}
