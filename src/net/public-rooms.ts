/**
 * The list of public rooms, without a server: while its owner is in a public room, the owner's browser announces it
 * on the relays as a short-lived event (kind 30078, t=makervale-live, NIP-40 expiration two minutes ahead), signed
 * with the room's owner key and renewed every minute. When the owner leaves (or the tab dies), the announcement
 * is withdrawn, or simply expires: the list only ever shows rooms someone can actually join, with their owner in.
 */
import { stripControl } from "@/lib/text";
import { APP_DATA_KIND, eventTag, nowSeconds, signedEventBy, verifyEvent } from "./nostr";
import type { NostrEvent } from "./nostr";
import { publishEvent } from "./relay-query";
import type { RelayHandler } from "./relay-sockets";
import { OPENED, existingSocket, relaySend, relaySocket } from "./relay-sockets";
import { relaysReady } from "./relays";
import { canonicalCode } from "./room-code";

const TAG = "makervale-live";
const TTL_S = 120;
const REFRESH_MS = 60_000;
const LIST_TICK_MS = 10_000;

export interface PublicRoom {
  code: string;
  name: string;
  owner: string;
  /** the owner's key: the room's rules must name the same one */
  ownerKey: string;
  people: number;
  /** newcomers may build without asking */
  open: boolean;
  /** seconds */
  at: number;
  expires: number;
}

export type Announcement = Pick<PublicRoom, "code" | "name" | "owner" | "people" | "open">;

/* ---------- the owner's side ---------- */

interface Announcing {
  secret: Uint8Array;
  info: () => Announcement;
  timer: ReturnType<typeof setInterval>;
}
let announcing: Announcing | null = null;

async function publish(a: Announcing, closed = false): Promise<void> {
  const tags = [
    ["d", TAG],
    ["t", TAG],
    ["expiration", String(nowSeconds() + (closed ? 30 : TTL_S))],
  ];
  const content = closed ? { v: 1, closed: true } : { v: 1, ...a.info() };
  await publishEvent(await signedEventBy(a.secret, APP_DATA_KIND, tags, JSON.stringify(content))).catch(() => 0);
}

export function announce(ownerSecret: Uint8Array, info: () => Announcement): void {
  withdraw();
  const a: Announcing = { secret: ownerSecret, info, timer: setInterval(() => void publish(a), REFRESH_MS) };
  announcing = a;
  void publish(a);
}

/** the people count changed: say so now rather than at the next renewal */
export function refreshAnnouncement(): void {
  if (announcing) void publish(announcing);
}

export function withdraw(): void {
  if (!announcing) return;
  clearInterval(announcing.timer);
  void publish(announcing, true);
  announcing = null;
}

/* ---------- everyone's side ---------- */

const clean = (s: unknown, n: number): string => stripControl(String(s ?? "")).slice(0, n);
const bounded = (x: unknown, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, Math.floor(+(x as number) || lo)));

function parse(ev: NostrEvent): PublicRoom | "closed" | null {
  if (ev.kind !== APP_DATA_KIND || eventTag(ev, "d") !== TAG || !verifyEvent(ev)) return null;
  const expires = +eventTag(ev, "expiration") || 0;
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(ev.content);
  } catch {
    return null;
  }
  if (c.closed) return "closed";
  const code = typeof c.code === "string" ? canonicalCode(c.code) : null;
  if (!code || expires < nowSeconds()) return null;
  const name = clean(c.name, 60) || "Untitled room";
  const owner = clean(c.owner, 32) || "Someone";
  return {
    code,
    name,
    owner,
    ownerKey: ev.pubkey,
    people: bounded(c.people, 1, 999),
    open: c.open === true,
    at: ev.created_at,
    expires,
  };
}

function onEvent(seen: Map<string, PublicRoom>, ev: NostrEvent): boolean {
  const room = parse(ev);
  if (!room) return false;
  const old = seen.get(ev.pubkey);
  if (old && old.at > ev.created_at) return false;
  if (room === "closed") return seen.delete(ev.pubkey);
  seen.set(ev.pubkey, room);
  return true;
}

function listener(sub: string, filter: () => object, onEv: (ev: NostrEvent) => void) {
  return (url: string): RelayHandler =>
    (m) => {
      if (m[0] === OPENED) relaySend(relaySocket(url), ["REQ", sub, filter()]);
      else if (m[0] === "EVENT" && m[1] === sub && m[2] && typeof m[2] === "object") onEv(m[2] as NostrEvent);
    };
}

/** the public rooms now, kept up to date; returns a function that stops listening */
export function browsePublicRooms(onList: (rooms: PublicRoom[]) => void): () => void {
  const sub = "live" + Math.random().toString(36).slice(2, 8);
  const seen = new Map<string, PublicRoom>();
  const emit = () => {
    const now = nowSeconds();
    onList([...seen.values()].filter((r) => r.expires > now).sort((a, b) => b.people - a.people || b.at - a.at));
  };
  let stopped = false;
  const filter = () => ({ kinds: [APP_DATA_KIND], "#t": [TAG], since: nowSeconds() - TTL_S - 30, limit: 300 });
  const handlers = new Map<string, RelayHandler>();
  const listen = listener(sub, filter, (ev) => onEvent(seen, ev) && emit());
  void relaysReady().then((urls) => {
    if (stopped) return;
    for (const url of urls) {
      handlers.set(url, listen(url));
      relaySocket(url).handlers.add(handlers.get(url)!);
      relaySend(relaySocket(url), ["REQ", sub, filter()]);
    }
    emit();
  });
  const tick = setInterval(emit, LIST_TICK_MS);
  return () => {
    stopped = true;
    clearInterval(tick);
    for (const [url, h] of handlers) {
      const c = existingSocket(url);
      if (!c) continue;
      relaySend(c, ["CLOSE", sub]);
      c.handlers.delete(h);
    }
  };
}
