/**
 * One-off conversations with the relays: ask all of them for stored events (until each says it has sent all it has,
 * or time runs out), and publish an event (counting the relays that accept it). Queries remember which relay sent
 * which event and which relays answered in full, so a visitor can put back what a relay lost (vault/repair.ts).
 */
import type { NostrEvent } from "./nostr";
import type { RelayHandler } from "./relay-sockets";
import { existingSocket, relaySend, relaySocket } from "./relay-sockets";
import { currentRelays, relaysReady } from "./relays";

export type Filter = Record<string, unknown>;

const QUERY_MS = 6000;
const PUBLISH_MS = 6000;

export interface QueryResult {
  events: NostrEvent[];
  /** event id → the relays that sent it */
  holders: Map<string, Set<string>>;
  /** relays that said they had sent everything (a relay that timed out tells us nothing) */
  answered: Set<string>;
}

let subCount = 0;
const newSub = () => "mv" + (++subCount).toString(36) + Math.random().toString(36).slice(2, 6);

function isEvent(x: unknown): x is NostrEvent {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return typeof e.id === "string" && typeof e.content === "string" && Array.isArray(e.tags);
}

interface Query {
  sub: string;
  found: Map<string, NostrEvent>;
  holders: Map<string, Set<string>>;
  answered: Set<string>;
  waiting: Set<string>;
  done: () => void;
}

function queryHandler(q: Query, url: string): RelayHandler {
  return (m) => {
    if (m[0] === "EVENT" && m[1] === q.sub && isEvent(m[2])) {
      q.found.set(m[2].id, m[2]);
      if (!q.holders.has(m[2].id)) q.holders.set(m[2].id, new Set());
      q.holders.get(m[2].id)!.add(url);
    } else if ((m[0] === "EOSE" || m[0] === "CLOSED") && m[1] === q.sub) {
      if (m[0] === "EOSE") q.answered.add(url);
      q.waiting.delete(url);
      if (!q.waiting.size) q.done();
    }
  };
}

const emptyResult = (): QueryResult => ({ events: [], holders: new Map(), answered: new Set() });

/** stored events matching the filters, from every relay in use, and who holds which */
export async function queryRelaysDetailed(filters: Filter[], ms = QUERY_MS): Promise<QueryResult> {
  const urls = await relaysReady();
  if (!urls.length) return emptyResult();
  return new Promise((resolve) => {
    const q: Query = {
      sub: newSub(),
      found: new Map(),
      holders: new Map(),
      answered: new Set(),
      waiting: new Set(urls),
      done: () => {},
    };
    const handlers = new Map(urls.map((u) => [u, queryHandler(q, u)]));
    let finished = false;
    q.done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      for (const [url, h] of handlers) {
        const c = existingSocket(url);
        if (!c) continue;
        c.handlers.delete(h);
        relaySend(c, ["CLOSE", q.sub]);
      }
      resolve({ events: [...q.found.values()], holders: q.holders, answered: q.answered });
    };
    const timer = setTimeout(q.done, ms);
    for (const [url, h] of handlers) {
      const c = relaySocket(url);
      c.handlers.add(h);
      relaySend(c, ["REQ", q.sub, ...filters]);
    }
  });
}

/** stored events matching the filters, from every relay in use (duplicates removed) */
export const queryRelays = async (filters: Filter[], ms = QUERY_MS): Promise<NostrEvent[]> =>
  (await queryRelaysDetailed(filters, ms)).events;

/** publish to these relays; resolves with how many accepted it */
export function publishTo(urls: string[], ev: NostrEvent, ms = PUBLISH_MS): Promise<number> {
  if (!urls.length) return Promise.resolve(0);
  let accepted = 0;
  let answered = 0;
  return new Promise((resolve) => {
    const handler: RelayHandler = (m) => {
      if (m[0] !== "OK" || m[1] !== ev.id) return;
      answered++;
      if (m[2] === true) accepted++;
      if (answered === urls.length) end();
    };
    const end = () => {
      clearTimeout(timer);
      for (const url of urls) existingSocket(url)?.handlers.delete(handler);
      resolve(accepted);
    };
    const timer = setTimeout(end, ms);
    for (const url of urls) {
      const c = relaySocket(url);
      c.handlers.add(handler);
      relaySend(c, ["EVENT", ev]);
    }
  });
}

/** publish to every relay in use; resolves with how many accepted it */
export async function publishEvent(ev: NostrEvent, ms = PUBLISH_MS): Promise<number> {
  const urls = currentRelays().length ? currentRelays() : await relaysReady();
  return publishTo(urls, ev, ms);
}
