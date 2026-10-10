/** The Privacy window (Help › Privacy): the full privacy note and terms, the same text the start screen showed. */
import { PRIVACY_HTML } from "@/app/privacy";

export const PRIVACY_WINDOW_HTML = `<section class="floater help" id="privacy" aria-label="Privacy" hidden>
  <div class="fhead" data-drag><span class="ft">Privacy and terms</span><button class="x" data-close="privacy" title="Close"><svg viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6"><path d="M1 1l8 8M9 1 1 9"/></svg></button></div>
  <div class="fbody"><div class="note privacy">${PRIVACY_HTML}</div></div>
</section>`;
