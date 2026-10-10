/**
 * Which Nostr relays to use: a pool, probed at startup.
 *
 * Public relays come and go, and some refuse some networks or apps. So instead of a fixed short list, every browser
 * tries a pool (Trystero's curated list of relays that carry this kind of traffic, plus a few large general ones),
 * in the same seeded order everywhere, and uses the first WANT that answer. Browsers that can reach the same relays
 * therefore pick the same ones, and a relay that fails for you is simply skipped.
 */
import { defaultRelayUrls } from "trystero/nostr";
import { whenOnline } from "./online";
import { queryList } from "./query";

const EXTRA = ["wss://nostr.mom", "wss://relay.nostr.net", "wss://relay.primal.net", "wss://offchain.pub"];
const WANT = 8;
const SEED = 0x5a4db0c5;
const PROBE_MS = 9000;
const RETRY_MS = 30_000;

/** `?relays=` fixes the relays outright; `?pool=` replaces the pool that gets probed */
const OVERRIDE = queryList("relays");
const POOL_OVERRIDE = queryList("pool");

/** the same shuffle everywhere: a xorshift-style hash drives a Fisher-Yates pass */
function seededOrder<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917);
    const j = (s >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const RELAY_POOL: string[] =
  OVERRIDE || POOL_OVERRIDE || seededOrder([...new Set([...defaultRelayUrls, ...EXTRA])], SEED);

interface Answer {
  url: string;
  ms: number;
}

/** the relays in use (empty until the first probe found some) */
let relays: string[] = OVERRIDE ? [...OVERRIDE] : [];
const probe = { done: !!OVERRIDE, answered: [] as Answer[], failed: [] as string[], tried: 0 };
/** open sockets, reported by relay-sockets.ts */
const sockets = { reachable: 0, tried: 0 };
const statusListeners = new Set<() => void>();
let readyP: Promise<string[]> | null = null;

/** time to open a WebSocket to a relay, or null if it doesn't answer within `ms` */
export function probeRelay(url: string, ms: number): Promise<number | null> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let ws: WebSocket;
    let done = false;
    const end = (v: number | null) => {
      if (done) return;
      done = true;
      try {
        ws.close();
      } catch {
        /* never opened */
      }
      resolve(v);
    };
    try {
      ws = new WebSocket(url);
    } catch {
      resolve(null);
      return;
    }
    ws.onopen = () => end(Math.round(performance.now() - t0));
    ws.onerror = () => end(null);
    setTimeout(() => end(null), ms);
  });
}

async function probePool(): Promise<string[]> {
  // all at once, generous timeout: a relay that answers late is still a relay that answers
  probe.tried = RELAY_POOL.length;
  const times = await Promise.all(RELAY_POOL.map((u) => probeRelay(u, PROBE_MS)));
  probe.answered = RELAY_POOL.map((url, i) => ({ url, ms: times[i] as number })).filter((a) => a.ms !== null);
  probe.failed = RELAY_POOL.filter((_, i) => times[i] === null);
  probe.done = true;
  relays = probe.answered.slice(0, WANT).map((a) => a.url);
  if (!relays.length) {
    // nothing answered: try again later
    readyP = null;
    setTimeout(() => void relaysReady().then(tellStatus), RETRY_MS);
  }
  tellStatus();
  return relays;
}

/** probe the pool (once; again later if nothing answered) and settle on the relays to use */
export function relaysReady(): Promise<string[]> {
  if (OVERRIDE) return Promise.resolve([...relays]);
  if (!readyP) readyP = probePool();
  return readyP;
}

/** the relays chosen so far */
export const currentRelays = (): string[] => [...relays];

/** for the connection test */
export const relayProbe = () => ({
  ...probe,
  answered: [...probe.answered],
  failed: [...probe.failed],
  pool: RELAY_POOL.length,
  using: [...relays],
});

/** relays for a room right now: the probed ones, or (before the probe finishes) the start of the pool */
export const roomRelays = (): string[] => (relays.length ? [...relays] : RELAY_POOL.slice(0, WANT));

export const relayStatus = () => ({ ...sockets, total: relays.length, probing: !probe.done });

export function onRelayStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function tellStatus(): void {
  statusListeners.forEach((f) => f());
}

/** relay-sockets.ts reports how many of its sockets are open */
export function reportSockets(reachable: number, tried: number): void {
  sockets.reachable = reachable;
  sockets.tried = tried;
  tellStatus();
}

// the probe waits for the privacy note to be accepted: until then the page contacts nobody
whenOnline(() => void relaysReady());
