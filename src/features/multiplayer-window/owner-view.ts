/** The owner's settings in a room, and the tools against damage. Everyone else reads the settings as one sentence. */
import { esc } from "@/ui/dom";
import { fold, objects } from "./format";
import type { Changer, Session, VaultStatus } from "./port";

export type ScriptShare = (id: string) => number | null;

interface Switch {
  id: string;
  on: boolean;
  label: string;
  yes: string;
  no: string;
  extra?: string;
}

function switchRow(s: Switch): string {
  return `<label class="mp-switch"><input type="checkbox" id="${s.id}" ${s.on ? "checked" : ""}><span class="sw-knob"></span>
    <span class="sw-t"><b>${s.label}</b><span>${s.on ? s.yes : s.no}</span>${s.extra ?? ""}</span></label>`;
}

function vaultLine(v: VaultStatus): string {
  const text: Record<VaultStatus["state"], string> = {
    off: "",
    loading: "Checking the copy online…",
    saving: "Saving the copy online…",
    saved: "Saved online.",
    failed: "Couldn't save it online just now; it will try again.",
    none: "No copy online yet: it is saved after the next change.",
  };
  return text[v.state] ? `<span class="mp-vault ${v.state}">${text[v.state]}</span>` : "";
}

function privateSwitches(session: Session): string {
  const r = session.net.rules!;
  const build = {
    id: "mp-everyone",
    on: r.build === "all",
    label: "Everyone builds",
    yes: "Everyone with the link can change the scene.",
    no: "Only you, and people you let below.",
  };
  const keep = {
    id: "mp-keep",
    on: r.keep,
    label: "Keep online",
    yes: "An encrypted copy stays on public relays: anyone with the link can open the room any time.",
    no: "The room exists only while someone is in it.",
    extra: r.keep ? vaultLine(session.net.vault) : "",
  };
  return switchRow(build) + switchRow(keep);
}

function publicSwitches(session: Session): string {
  const r = session.net.rules!;
  const open = {
    id: "mp-everyone",
    on: r.build === "all",
    label: "Guests can build",
    yes: "Everyone who comes in can change the scene.",
    no: "Guests watch until you let them, one by one below.",
  };
  return (
    switchRow(open) +
    `<div class="mp-row"><button class="btn small" id="mp-lockdown">Lockdown</button>
    <span class="note">Nobody but you builds; newcomers only watch.</span></div>`
  );
}

/** a public room's code is out there for good, so it can't become private again: a copy can */
function kindRow(session: Session): string {
  if (session.net.rules?.kind === "public") {
    return `<p class="note mp-kind">This room is public for good: its code is on the public list. For a private
      room, make a copy: a new private room with a new link.</p>`;
  }
  return `<div class="mp-row mp-kind"><span class="note">This room is private.</span>
    <button class="btn small quiet" id="mp-kind" data-kind="public">Make it public</button></div>`;
}

/** what one person did here: how much they changed, how much their scripts take, and the owner's answers */
function changerRow(c: Changer, scriptShare: ScriptShare, shown: boolean): string {
  const who = esc(c.name) + (c.here ? "" : ` <i>(left)</i>`);
  const shares = c.scripts.map(scriptShare);
  const measured = shares.every((x) => x !== null);
  const share = measured ? Math.round(shares.reduce((s: number, x) => s + (x ?? 0), 0)) : 0;
  const count = `${c.scripts.length} script${c.scripts.length === 1 ? "" : "s"}`;
  const scripts = c.scripts.length ? ` · ${count}${measured ? `, ${share}% of script time` : ""}` : "";
  const name = esc(c.name);
  return `<div class="mp-item${share >= 40 ? " mp-heavy" : ""}"><div class="mp-item-t"><b>${who}</b><span>changed ${objects(c.objects)}${scripts}</span></div>
    <div class="mp-item-a"><button class="btn small${shown ? "" : " quiet"}" data-show="${esc(c.who)}" data-name="${name}" aria-pressed="${shown}" title="Select what they changed and look at it">${shown ? "Hide" : "Show"}</button>
      <button class="btn small" data-undo="${esc(c.who)}" data-name="${name}">Undo their changes</button></div></div>`;
}

function damageHTML(session: Session, scriptShare: ScriptShare, folds: ReadonlySet<string>): string {
  const changers = session.changers();
  const reach = session.rewindReach();
  if (!changers.length && reach < 1) return "";
  const rows = changers.map((c) => changerRow(c, scriptShare, session.showingChanges(c.who)));
  const minutes = [1, 5, 15, 30].map(
    (m) => `<button class="btn small" data-rewind="${m}" ${m > reach ? "disabled" : ""}>${m} min</button>`,
  );
  return fold(
    folds,
    "changes",
    "Who changed what",
    `<p class="note">Everyone who changed something here this session, and how much of the room's script time their
      scripts take. Show picks out their changes in the scene; Undo puts them back as they were.</p>
    ${rows.length ? `<div class="mp-items">${rows.join("")}</div>` : ""}
    <div class="mp-row mp-rewind"><span class="note">Rewind the whole room</span>${minutes.join("")}</div>`,
  );
}

export function ownerHTML(session: Session, scriptShare: ScriptShare, folds: ReadonlySet<string>): string {
  if (!session.amOwner() || !session.net.rules) return "";
  const pub = session.net.rules.kind === "public";
  return `<div class="mp-owner">${pub ? publicSwitches(session) : privateSwitches(session)}${kindRow(session)}</div>${damageHTML(session, scriptShare, folds)}`;
}

/** the owner's settings as everyone else sees them */
export function rulesSentence(session: Session): string {
  const r = session.net.rules;
  if (!r) return "";
  if (r.kind === "public")
    return r.build === "all"
      ? "Public room: guests can build."
      : "Public room: guests watch until the owner lets them build.";
  const build = r.build === "all" ? "everyone builds" : "the owner decides who builds";
  return `Private room: ${build}${r.keep ? ", kept online" : ""}.`;
}
