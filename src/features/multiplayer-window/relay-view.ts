/** The bottom of the window: your own TURN relay, the connection test and its report, and the version. */
import { esc } from "@/ui/dom";
import { checkMark } from "./format";
import type { Check, Report, TurnPrefs } from "./port";
import type { MpState } from "./state";
import { BUILD } from "./version";

const field = (label: string, input: string) => `<label class="rl-field"><span>${label}</span>${input}</label>`;

function relayFields(prefs: TurnPrefs): string {
  const t = prefs.custom;
  const urls = esc(t ? t.urls.join(" ") : "");
  const address = `<input class="tf" id="mp-turn-urls" placeholder="turn:relay.example.com:3478" value="${urls}"
    spellcheck="false" autocomplete="off">`;
  const user = `<input class="tf" id="mp-turn-user" value="${esc(t?.username ?? "")}"
    spellcheck="false" autocomplete="off">`;
  const pass = `<input class="tf" id="mp-turn-pass" type="password" value="${esc(t?.credential ?? "")}"
    autocomplete="new-password">`;
  return field("Address", address) + `<div class="rl-pair">${field("Username", user)}${field("Password", pass)}</div>`;
}

export function relayHTML(prefs: TurnPrefs): string {
  const on = !!prefs.custom;
  const remove = on ? `<button class="btn small" id="mp-turn-clear">Remove</button>` : "";
  return `<details class="mp-relay"${on ? " open" : ""}><summary>Relay server (TURN)${on ? " · on" : ""}</summary>
    <div class="rl-body">
      <p class="note">When two routers can't connect directly (strict NAT on both sides), traffic has to go through
        a relay. One working relay on either side is enough. Free ones: an ExpressTURN account (expressturn.com,
        1000 GB a month) or Metered's Open Relay (metered.ca). Sign up, copy the address, username and password
        here, save, then test your connection. The relay then sees your room traffic (see Help › Privacy).</p>
      ${relayFields(prefs)}
      <div class="rl-actions">${remove}<button class="btn small primary" id="mp-turn-save">Save relay</button></div>
      <p class="note">Kept only in this browser, and used for the next room you open or join.</p>
    </div></details>`;
}

function checkLine(c: Check): string {
  const open = c.state !== "ok" ? " open" : "";
  const list = c.list
    ? `<details class="mp-list"${open}><summary>each relay</summary><pre>${esc(c.list)}</pre></details>`
    : "";
  const text = `<b>${esc(c.name)}</b> ${esc(c.detail)}${list}`;
  return `<div class="${c.state}"><span>${checkMark(c.state)}</span><div>${text}</div></div>`;
}

/** the build stamp, so it's obvious which version is running (a copy opened from disk doesn't update itself) */
function versionLine(): string {
  const fromDisk =
    location.protocol === "file:" ? "<span>Opened from a file on disk, so it won’t update by itself.</span>" : "";
  return `<p class="mp-build"><span>Version ${esc(BUILD)}</span>${fromDisk}</p>`;
}

function reportHTML(r: Report): string {
  const checks = r.checks.map(checkLine).join("");
  return `<div class="mp-check ${r.verdict}"><b>${esc(r.summary)}</b>${checks}${versionLine()}</div>`;
}

/** withdrawing consent must be as easy as giving it: one button, always in view while online */
const WITHDRAW = `<h4>Your consent</h4>
  <div class="mp-row"><button class="btn small" id="mp-withdraw">Withdraw consent</button>
    <span class="note">Leaves the room and goes offline at once.</span></div>`;

export function connectionHTML(prefs: TurnPrefs, state: MpState): string {
  const label = state.checking ? "Testing…" : "Test my connection";
  const button = `<button class="btn small" id="mp-check" ${state.checking ? "disabled" : ""}>${label}</button>`;
  const row = `<div class="mp-row">${button}<span class="note">Will rooms work from here?</span></div>`;
  return relayHTML(prefs) + row + (state.report ? reportHTML(state.report) : "") + WITHDRAW;
}
