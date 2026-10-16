/**
 * Who is in the room, and how to reach each of them. A peer is reached directly when WebRTC connected us, else
 * through the relay channel. The channel's roster (everyone says "I'm here" through it now and then) is how we learn
 * about people we couldn't connect to: after a grace period, in which a direct connection usually forms, they join
 * as relayed peers. A peer leaves when neither way knows them any more.
 */

export type Route = "direct" | "relay";

export interface MemberHooks {
  join(id: string): void;
  leave(id: string): void;
}

/** time for a direct connection to form before falling back to the relays */
export const GRACE_MS = 7000;
/** someone whose "I'm here" stopped this long ago has gone */
export const ROSTER_TTL_MS = 45_000;

export class Members {
  private direct = new Set<string>();
  private relayed = new Set<string>();
  /** roster: id → when we last heard "I'm here" through the relays */
  private heard = new Map<string, number>();
  /** heard of, but neither connected nor relayed yet: id → since when */
  private pending = new Map<string, number>();

  constructor(private hooks: MemberHooks) {}

  route(id: string): Route | null {
    if (this.direct.has(id)) return "direct";
    return this.relayed.has(id) ? "relay" : null;
  }

  /** everyone we can only reach through the relays */
  relayTargets(): string[] {
    return [...this.relayed];
  }

  directCount(): number {
    return this.direct.size;
  }

  directUp(id: string): void {
    this.pending.delete(id);
    this.direct.add(id);
    if (!this.relayed.delete(id)) this.hooks.join(id);
  }

  /** a direct connection closed: if the relays still hear them, they stay, reached through the relays */
  directDown(id: string, now: number): void {
    if (!this.direct.delete(id)) return;
    if (this.alive(id, now)) this.relayed.add(id);
    else this.hooks.leave(id);
  }

  /** "I'm here" (or any message) from someone through the relays */
  heardFrom(id: string, now: number): void {
    this.heard.set(id, now);
    if (!this.route(id) && !this.pending.has(id)) this.pending.set(id, now);
  }

  /** a message that came through the relays: its sender treats us as relayed, so we do too, at once */
  relayedNow(id: string, now: number): void {
    this.heard.set(id, now);
    if (this.route(id)) return;
    this.pending.delete(id);
    this.relayed.add(id);
    this.hooks.join(id);
  }

  /** "bye" through the relays, or removed from the room */
  gone(id: string): void {
    this.heard.delete(id);
    this.pending.delete(id);
    if (this.relayed.delete(id)) this.hooks.leave(id);
  }

  /** now and then: the grace period ran out for some, others stopped saying they're here */
  tick(now: number): void {
    for (const [id, since] of this.pending) {
      if (now - since < GRACE_MS) continue;
      this.pending.delete(id);
      if (this.alive(id, now)) this.relayedNow(id, now);
    }
    for (const id of this.relayed) if (!this.alive(id, now)) this.gone(id);
  }

  private alive(id: string, now: number): boolean {
    const at = this.heard.get(id);
    return at !== undefined && now - at < ROSTER_TTL_MS;
  }
}
