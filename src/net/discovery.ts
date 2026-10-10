/**
 * Room discovery without a server of our own: a host announces its room as a short-lived Nostr event on a few public
 * relays (kind 30078 "app data", tagged t=piaskownica-room, with a NIP-40 expiration), and the lobby asks the same
 * relays for recent announcements.
 */
import { stripControl } from "@/lib/text";
import { currentRelays, relaysReady } from "./relays";
import type { RelayHandler } from "./relay-sockets";
import { OPENED, existingSocket, relaySend, relaySocket } from "./relay-sockets";
import { APP_DATA_KIND, eventTag, nowSeconds, signedEvent } from "./nostr";

const TAG = "piaskownica-room";
const TTL_S = 240;
const GRACE_S = 30;
const REFRESH_MS = 90_000;
const LIST_TICK_MS = 15_000;
const DETACH_MS = 3000;

export interface RoomAd {
  id: string;
  name: string;
  host: string;
  people: number;
  objects: number;
  at: number;
  key: string;
}

export type RoomInfo = Omit<RoomAd, "id" | "at" | "key">;

/* ---------- hosting: announce, refresh, withdraw ---------- */

interface AdState {
  id: string;
  info: () => RoomInfo;
}

let adTimer = 0;
let adState: AdState | null = null;
/** keeps the sockets alive while we advertise; see relay-sockets.ts */
const keepAlive: RelayHandler = () => {};

async function publishAd(closed = false): Promise<void> {
  if (!adState) return;
  const expires = nowSeconds() + (closed ? 1 : TTL_S);
  const tags = [
    ["d", "piaskownica:" + adState.id],
    ["t", TAG],
    ["expiration", String(expires)],
  ];
  const content = closed ? { v: 1, closed: true } : { v: 1, room: adState.id, ...adState.info() };
  const ev = await signedEvent(APP_DATA_KIND, tags, JSON.stringify(content));
  for (const url of currentRelays()) relaySend(relaySocket(url), ["EVENT", ev]);
}

export function advertise(id: string, info: () => RoomInfo): void {
  stopAdvertising();
  const state: AdState = { id, info };
  adState = state;
  void relaysReady().then(() => {
    if (adState !== state) return;
    for (const url of currentRelays()) relaySocket(url).handlers.add(keepAlive);
    void publishAd();
    adTimer = window.setInterval(() => void publishAd(), REFRESH_MS);
  });
}

export function refreshAd(): void {
  if (adState) void publishAd();
}

export function stopAdvertising(): void {
  if (!adState) return;
  clearInterval(adTimer);
  void publishAd(true);
  adState = null;
  // the withdrawal must still go out before the sockets may close
  setTimeout(() => {
    for (const url of currentRelays()) existingSocket(url)?.handlers.delete(keepAlive);
  }, DETACH_MS);
}

/* ---------- browsing ---------- */

const clean = (s: unknown, n: number): string => stripControl(String(s ?? "")).slice(0, n);
const ROOM_ID = /^[\w-]{6,40}$/;

interface Listing {
  sub: string;
  seen: Map<string, RoomAd>;
  emit: () => void;
}

function parseContent(ev: Record<string, unknown>): Record<string, unknown> | null {
  if (ev.kind !== APP_DATA_KIND || typeof ev.content !== "string") return null;
  const expires = +eventTag(ev, "expiration") || 0;
  if (expires && expires < nowSeconds()) return null;
  try {
    return JSON.parse(ev.content);
  } catch {
    return null;
  }
}

const bounded = (x: unknown, lo: number, hi: number, fallback: number): number =>
  Math.max(lo, Math.min(hi, +(x as number) || fallback));

function toAd(key: string, c: Record<string, unknown>, at: number): RoomAd {
  return {
    key,
    id: c.room as string,
    name: clean(c.name, 60) || "Untitled room",
    host: clean(c.host, 32) || "Someone",
    people: bounded(c.people, 1, 999, 1),
    objects: bounded(c.objects, 0, 1e5, 0),
    at,
  };
}

function readAd(listing: Listing, ev: Record<string, unknown>): void {
  const c = parseContent(ev);
  if (!c) return;
  const key = ev.pubkey + "|" + eventTag(ev, "d");
  if (c.closed) {
    listing.seen.delete(key);
    listing.emit();
    return;
  }
  if (typeof c.room !== "string" || !ROOM_ID.test(c.room)) return;
  const at = +(ev.created_at as number) || nowSeconds();
  const old = listing.seen.get(key);
  if (old && old.at > at) return;
  listing.seen.set(key, toAd(key, c, at));
  listing.emit();
}

/** live list of announced rooms; returns a function that stops listening */
export function browse(onList: (rooms: RoomAd[]) => void): () => void {
  const sub = "pias" + Math.random().toString(36).slice(2, 8);
  const listing: Listing = { sub, seen: new Map(), emit: () => {} };
  listing.emit = () => {
    const t = nowSeconds();
    const fresh = [...listing.seen.values()].filter((r) => t - r.at < TTL_S + GRACE_S);
    onList(fresh.sort((a, b) => b.at - a.at));
  };
  let urls: string[] = [];
  let stopped = false;
  const request = () => {
    const filter = { kinds: [APP_DATA_KIND], "#t": [TAG], since: nowSeconds() - TTL_S - 60, limit: 200 };
    for (const url of urls) relaySend(relaySocket(url), ["REQ", sub, filter]);
  };
  const handler: RelayHandler = (m) => {
    if (m[0] === OPENED) request();
    else if (m[0] === "EVENT" && m[1] === sub && m[2] && typeof m[2] === "object") {
      readAd(listing, m[2] as Record<string, unknown>);
    }
  };
  void relaysReady().then((relays) => {
    if (stopped) return;
    urls = relays;
    for (const url of urls) relaySocket(url).handlers.add(handler);
    request();
  });
  const tick = window.setInterval(listing.emit, LIST_TICK_MS);
  return () => {
    stopped = true;
    clearInterval(tick);
    for (const url of urls) {
      const c = existingSocket(url);
      if (!c) continue;
      relaySend(c, ["CLOSE", sub]);
      c.handlers.delete(handler);
    }
  };
}
