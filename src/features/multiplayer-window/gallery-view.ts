/** The Gallery tab: published worlds you can look at or copy, yours with their versions, and publishing. */
import { esc } from "@/ui/dom";
import { ago, objects } from "./format";
import type { WorldHead } from "./port";
import { publishFormHTML } from "./publish-view";
import type { MpState } from "./state";

const latest = (h: WorldHead) => h.versions[h.versions.length - 1];
const key = (h: WorldHead) => esc(h.author + ":" + h.id);

function worldRow(h: WorldHead): string {
  const v = latest(h);
  const about = h.about ? `<span class="mp-about">${esc(h.about)}</span>` : "";
  return `<div class="mp-item"><div class="mp-item-t"><b>${esc(h.title)}</b>
      <span>${esc(h.by)} · v${v.v} · ${objects(v.objects)} · ${ago(v.at)}</span>${about}</div>
    <div class="mp-item-a"><button class="btn small quiet" data-hide="${key(h)}" title="Hide it from your Gallery">Hide</button>
      <button class="btn small" data-view="${key(h)}">View</button></div></div>`;
}

function myRow(h: WorldHead): string {
  const v = latest(h);
  return `<div class="mp-item"><div class="mp-item-t"><b>${esc(h.title)}</b><span>v${v.v} · ${ago(v.at)}</span></div>
    <div class="mp-item-a"><button class="btn small quiet" data-unpublish="${key(h)}" data-name="${esc(h.title)}">Unpublish</button>
      <button class="btn small" data-view="${key(h)}">View</button></div></div>`;
}

function listHTML(s: MpState): string {
  if (!s.gallery) return `<p class="note">${s.galleryBusy ? "Loading the Gallery…" : ""}</p>`;
  if (!s.gallery.length) return `<p class="note">Nothing published yet. Be the first!</p>`;
  return `<div class="mp-items">${s.gallery.map(worldRow).join("")}</div>`;
}

const CANT_PUBLISH = `<p class="note">To publish, go back to your own scene or a room you own. Building on someone
    else's world? Make a copy first.</p>`;

function publishPart(s: MpState, canPublish: boolean): string {
  if (!canPublish) return CANT_PUBLISH;
  if (s.publishing) return publishFormHTML(s.myWorlds);
  return `<div class="mp-actions"><button class="btn primary" id="mp-publish-open">Publish this scene…</button></div>`;
}

export function galleryHTML(s: MpState, canPublish: boolean): string {
  const publish = publishPart(s, canPublish);
  const mine = s.myWorlds.length
    ? `<h4>Your worlds</h4><div class="mp-items">${s.myWorlds.map(myRow).join("")}</div>`
    : "";
  return `<p class="note">Worlds people published: look around in them on your own, or make a copy to build on.</p>
    ${publish}${mine}
    <h4>Worlds <button class="btn small quiet" id="mp-gallery-refresh">${s.galleryBusy ? "Loading…" : "Refresh"}</button></h4>
    ${listHTML(s)}`;
}

/** the world a data-view / data-hide / data-unpublish button names */
export function findWorld(s: MpState, k: string): WorldHead | undefined {
  return [...(s.gallery ?? []), ...s.myWorlds].find((h) => h.author + ":" + h.id === k);
}
