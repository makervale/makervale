/**
 * Read-repair: a scene on the relays survives because people open it, not because a relay or its writer is
 * reliable. After someone opened it, each relay that answered in full but lacks some of its events gets exactly
 * those events: the originals, signed as they were (re-signing an old manifest could replace a newer one).
 * It runs at a relay-friendly pace.
 */
import type { NostrEvent } from "../nostr";
import { publishTo } from "../relay-query";
import type { Sightings } from "./scene";

const MAX_EVENTS = 60;
const PACE_MS = 150;

const pause = () => new Promise((r) => setTimeout(r, PACE_MS));

/** relay → the events it should have but didn't send us (only relays that answered in full) */
export function repairPlan(seen: Sightings): Map<string, NostrEvent[]> {
  const plan = new Map<string, NostrEvent[]>();
  for (const ev of seen.events) {
    const have = seen.holders.get(ev.id) ?? new Set<string>();
    for (const url of seen.answered) {
      if (have.has(url)) continue;
      if (!plan.has(url)) plan.set(url, []);
      plan.get(url)!.push(ev);
    }
  }
  return plan;
}

/** resolves with the number of events sent */
export async function putBack(seen: Sightings, budget = MAX_EVENTS): Promise<number> {
  let sent = 0;
  for (const [url, events] of repairPlan(seen)) {
    for (const ev of events) {
      if (sent >= budget) return sent;
      await publishTo([url], ev);
      sent++;
      await pause();
    }
  }
  return sent;
}
