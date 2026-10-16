/**
 * The room's relay channel: when two browsers can't connect directly (both behind strict routers), their messages go
 * through the public Nostr relays instead, as short-lived events the relays pass on and don't keep. Everything is
 * sealed with the room's key; the relays see only a tag derived from the code, the size and the timing. No account
 * and no TURN server are needed, at the price of more delay than a direct connection.
 */
import type { NostrEvent } from "../nostr";
import { nowSeconds, signedEvent, verifyEvent } from "../nostr";
import { OPENED, existingSocket, relaySend, relaySocket } from "../relay-sockets";
import type { RelayHandler } from "../relay-sockets";
import { relaysReady } from "../relays";
import type { RoomKeys } from "../room-keys";
import { fromBase64, pack, seal, toBase64, unpack, unseal } from "../seal";
import { Governor, isRateLimit } from "./governor";
import type { Envelope } from "./outbox";
import { Outbox, cutParts } from "./outbox";
import { Reassembly } from "./reassembly";
import { readBatch } from "./read";

/** an ephemeral kind (20000–29999): relays forward it to subscribers and keep nothing */
export const CHANNEL_KIND = 24133;
const PART_CHARS = 40_000;
const MAX_PARTS = 48;
const MAX_SEEN = 4000;
const MAX_MINE = 200;

export interface Channel {
  post(env: Envelope): void;
  /** 0 at the normal pace, higher when the relays asked us to slow down (governor.ts) */
  readonly slowdown: number;
  /** send what waits right away (leaving) */
  flush(): Promise<void>;
  close(): void;
}

class RelayChannel implements Channel {
  private outbox = new Outbox();
  private parts = new Reassembly();
  private seen = new Set<string>();
  private sub = "ch" + Math.random().toString(36).slice(2, 10);
  private handlers = new Map<string, RelayHandler>();
  private inbox = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private governor = new Governor();
  /** ids of events we published lately, to recognise the relays' answers to them */
  private mine = new Set<string>();

  constructor(
    private keys: RoomKeys,
    private onEnvelope: (env: Envelope, sender: string) => void,
  ) {
    void relaysReady().then((urls) => this.listen(urls));
  }

  private listen(urls: string[]): void {
    if (this.closed) return;
    for (const url of urls) {
      const h: RelayHandler = (m) => this.onRelay(url, m);
      this.handlers.set(url, h);
      relaySocket(url).handlers.add(h);
      this.request(url);
    }
    if (this.outbox.size) void this.flush();
  }

  private request(url: string): void {
    const filter = { kinds: [CHANNEL_KIND], "#x": [this.keys.channel], since: nowSeconds() - 5 };
    relaySend(relaySocket(url), ["REQ", this.sub, filter]);
  }

  get slowdown(): number {
    return this.governor.level;
  }

  private onRelay(url: string, m: unknown[]): void {
    if (m[0] === OPENED) this.request(url);
    else if (m[0] === "OK" && this.mine.has(m[1] as string) && m[2] === false && isRateLimit(m[3])) {
      this.governor.complaint(Date.now());
    } else if (m[0] === "EVENT" && m[1] === this.sub && m[2] && typeof m[2] === "object") {
      const ev = m[2] as NostrEvent;
      // one at a time, in the order they came: unsealing is asynchronous, and edits must not overtake each other
      this.inbox = this.inbox.then(() => this.receive(ev)).catch(() => {});
    }
  }

  private async receive(ev: NostrEvent): Promise<void> {
    if (this.seen.has(ev.id) || typeof ev.content !== "string" || !verifyEvent(ev)) return;
    if (this.seen.size > MAX_SEEN) this.seen.clear();
    this.seen.add(ev.id);
    const whole = this.parts.add(ev.content, ev.pubkey);
    const sealed = whole && fromBase64(whole);
    const plain = sealed && (await unseal(this.keys, sealed));
    if (plain) for (const env of readBatch(unpack(plain))) this.onEnvelope(env, ev.pubkey);
  }

  post(env: Envelope): void {
    if (this.closed) return;
    this.outbox.add(env);
    if (this.timer) return;
    this.governor.tick(Date.now());
    this.timer = setTimeout(() => void this.flush(), this.governor.pauseMs);
  }

  async flush(): Promise<void> {
    this.timer = null;
    if (!this.outbox.size || !this.handlers.size) return;
    await this.sendBatch(this.outbox.take());
  }

  /** one batch, sealed and cut into parts; a batch with too many parts goes as two halves, in order */
  private async sendBatch(envs: Envelope[]): Promise<void> {
    const text = toBase64(await seal(this.keys, pack({ v: 1, e: envs })));
    const chunks = cutParts(text, PART_CHARS, Math.random().toString(36).slice(2, 10));
    if (chunks.length > MAX_PARTS) {
      // a single message this big can't go through the relays (a snapshot goes through the room's copy instead)
      if (envs.length === 1) return;
      const half = Math.ceil(envs.length / 2);
      await this.sendBatch(envs.slice(0, half));
      await this.sendBatch(envs.slice(half));
      return;
    }
    for (const chunk of chunks) await this.publish(chunk);
  }

  private async publish(content: string): Promise<void> {
    const ev = await signedEvent(CHANNEL_KIND, [["x", this.keys.channel]], content);
    if (this.mine.size > MAX_MINE) this.mine.clear();
    this.mine.add(ev.id);
    for (const url of this.handlers.keys()) relaySend(relaySocket(url), ["EVENT", ev]);
  }

  close(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    for (const [url, h] of this.handlers) {
      const c = existingSocket(url);
      if (!c) continue;
      relaySend(c, ["CLOSE", this.sub]);
      c.handlers.delete(h);
    }
  }
}

export const openChannel = (keys: RoomKeys, onEnvelope: (env: Envelope, sender: string) => void): Channel =>
  new RelayChannel(keys, onEnvelope);
