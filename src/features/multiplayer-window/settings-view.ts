/** The Settings tab: who you are, whether rooms work from here, and the advanced bits. */
import { esc } from "@/ui/dom";
import { fold } from "./format";
import type { Me, TurnPrefs } from "./port";
import { connectionHTML } from "./relay-view";
import type { MpState } from "./state";

export function identityRow(me: Me): string {
  return `<div class="mp-row"><span class="lbl">You are</span><b class="mp-me">${esc(me.name)}</b>
    <button class="btn small" id="mp-avatar">Avatar…</button></div>`;
}

const AUTHOR = `<p class="note">It signs the worlds you publish: only this key can publish their next versions or unpublish them.
      To do that from another browser, copy it there. Keep it secret.</p>
    <div class="mp-actions"><button class="btn small" id="mp-key-copy">Copy my key</button>
      <button class="btn small" id="mp-key-import">Use a key…</button></div>`;

const HIDDEN = `<div class="mp-row"><button class="btn small quiet" id="mp-unhide">Show hidden worlds again</button></div>`;

const HOW = `<p class="note">How it works: there is no server. Browsers connect to each other directly, or through
    public Nostr relays when routers make that impossible, encrypted with the room's key.</p>`;

export function settingsHTML(me: Me, prefs: TurnPrefs, state: MpState): string {
  return `${identityRow(me)}${HOW}${connectionHTML(prefs, state)}${fold(state.folds, "author", "Your author key", AUTHOR)}${HIDDEN}`;
}
