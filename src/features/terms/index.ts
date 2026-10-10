/**
 * The start screen: the privacy note and terms have to be accepted before the app can be used. Accepted once per
 * version of the text (kept in this browser); a new version asks again. Nothing is contacted either way: the
 * screen is only about what the person agrees to when they do go online.
 */
import { PRIVACY_HTML, TERMS_VERSION } from "@/app/privacy";
import { el } from "@/ui/dom";

const KEY = "pias.terms";

const HTML = `
  <div class="terms-card" role="dialog" aria-modal="true" aria-labelledby="terms-title">
    <h2 id="terms-title">Before you start</h2>
    <p class="terms-lead">Makervale is an experimental prototype with bugs, for adults (18+). It runs in your browser
      and sends nothing to its author. Its multiplayer connects you directly to other people, is unmoderated, and
      is outside the author's control. Please read how it works and what it risks; the same text is always under
      Help › Privacy.</p>
    <div class="terms-text">${PRIVACY_HTML}</div>
    <label class="check terms-adult"><input type="checkbox" id="terms-adult">I am 18 or older</label>
    <button class="btn primary" id="terms-accept" disabled>I have read this and accept it</button>
  </div>`;

export function accepted(): boolean {
  try {
    return localStorage.getItem(KEY) === TERMS_VERSION;
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    localStorage.setItem(KEY, TERMS_VERSION);
  } catch {
    // without storage it is asked again next time, which is fine
  }
}

/** shows the screen unless this version was accepted before; `onAccept` runs when it is (or at once) */
export function mount(onAccept: () => void): void {
  if (accepted()) {
    onAccept();
    return;
  }
  const veil = el("div", "terms-veil");
  veil.id = "terms";
  veil.innerHTML = HTML;
  document.body.appendChild(veil);
  const button = veil.querySelector<HTMLButtonElement>("#terms-accept")!;
  const adult = veil.querySelector<HTMLInputElement>("#terms-adult")!;
  // the app is for adults: the button only wakes once the age is confirmed
  adult.addEventListener("change", () => (button.disabled = !adult.checked));
  button.addEventListener("click", () => {
    if (!adult.checked) return;
    remember();
    veil.remove();
    onAccept();
  });
  adult.focus();
}
