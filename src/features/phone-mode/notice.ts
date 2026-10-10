/** The card a phone visitor sees first: this is a limited preview, the real thing is on a computer. */
import { el } from "@/ui/dom";

/** once per visit: a warning, not a nag */
const SEEN_KEY = "pias.phoneNotice";

const HTML = `
  <div class="phone-card" role="dialog" aria-modal="true" aria-labelledby="phone-title">
    <h2 id="phone-title">Phone preview: very limited</h2>
    <p>Makervale is made for a computer with a mouse and keyboard. On a phone you get a small taste of it:</p>
    <ul class="phone-can">
      <li>walk with the joystick, drag to look around, pinch to zoom</li>
      <li>tap the lanterns, the door, the fountain and the lift</li>
      <li>chat, change your avatar, join a room with friends</li>
    </ul>
    <p class="phone-cant">Building, the Tools and writing scripts don't work here.
      For the full Makervale, open this page on a computer.</p>
    <button class="btn primary" id="phone-ok">Look around anyway</button>
  </div>`;

function seen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // without storage it shows again next load, which is fine
  }
}

export function showPhoneNotice(): void {
  if (seen() || document.getElementById("phone-notice")) return;
  const veil = el("div", "phone-notice");
  veil.id = "phone-notice";
  veil.innerHTML = HTML;
  document.body.appendChild(veil);
  const close = () => {
    remember();
    veil.remove();
  };
  veil.querySelector<HTMLButtonElement>("#phone-ok")!.addEventListener("click", close);
  veil.querySelector<HTMLButtonElement>("#phone-ok")!.focus();
}
