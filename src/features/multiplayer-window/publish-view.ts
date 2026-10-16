/** Publishing: a new world, or the next version of one of yours. Said plainly: it is public, and stays out there. */
import { esc } from "@/ui/dom";
import type { WorldHead } from "./port";

function targetHTML(mine: WorldHead[]): string {
  if (!mine.length) return "";
  const options = mine.map(
    (h) => `<option value="${esc(h.author + ":" + h.id)}">New version of ${esc(h.title)}</option>`,
  );
  return `<select class="tf" id="mp-pub-target" aria-label="What to publish"><option value="">A new world</option>${options.join("")}</select>`;
}

export function publishFormHTML(mine: WorldHead[]): string {
  return `<div class="mp-card">
    <b>Publish this scene</b>
    ${targetHTML(mine)}
    <input class="tf" id="mp-pub-title" maxlength="60" placeholder="Title" aria-label="Title">
    <textarea class="tf" id="mp-pub-about" maxlength="400" rows="2" placeholder="What is it? (optional)" aria-label="About"></textarea>
    <input class="tf" id="mp-pub-note" maxlength="200" placeholder="What's new in this version? (optional)" aria-label="What's new" hidden>
    <span class="note">Anyone can see a published world and copy it. You can publish new versions and unpublish
      it, but copies people made stay theirs.</span>
    <div class="mp-actions"><button class="btn" id="mp-publish-cancel">Cancel</button>
      <button class="btn primary" id="mp-publish">Publish</button></div></div>`;
}
