/**
 * The Multiplayer window before going online (once per visit, and again after consent is withdrawn): what going
 * online shares, what can go wrong, the age check, and the button that agrees.
 */
import { GO_ONLINE_HTML } from "@/app/privacy";
import { identityRow } from "./lobby-view";
import type { Me } from "./port";

export function goOnlineHTML(me: Me): string {
  return `${identityRow(me)}
    <h4>Go online?</h4>
    ${GO_ONLINE_HTML}
    <p class="note">The full text is under Help › Privacy. Your answer lasts for this visit, and you can withdraw it
      any time here. Until you agree, the app contacts nobody, and you can keep building on your own.</p>
    <label class="check mp-adult"><input type="checkbox" id="mp-adult">I am 18 or older</label>
    <div class="mp-row">
      <button class="btn primary" id="mp-agree">I accept the risks, go online</button>
      <button class="btn" id="mp-later">Stay offline</button>
    </div>`;
}
