/**
 * "Can I actually reach that room?" Whoever lists a room publicly also waits in a tiny side room ("probe:<code>")
 * that answers pings. Before a public room is offered, the browser joins that side room, sends a ping over the same
 * kind of connection the real room would use (direct or through the relay) and measures the round trip.
 */
import { joinRoom } from "trystero/nostr";
import type { Room } from "trystero/nostr";
import { roomConfig } from "./transport";

/** an alias, not an interface, so it satisfies Trystero's index-signature payload constraint */
type Ping = {
  k: "ping" | "pong";
  t: number;
};

const sideRoom = (id: string): Room => joinRoom(roomConfig(), "probe:" + id);
const isPing = (d: unknown, kind: Ping["k"]): d is Ping =>
  !!d && typeof d === "object" && (d as Ping).k === kind && typeof (d as Ping).t === "number";

/* ---------- the host side: answer pings while the room is listed ---------- */

let answering: { id: string; room: Room } | null = null;

export function answerPings(id: string): void {
  if (answering?.id === id) return;
  stopAnswering();
  const room = sideRoom(id);
  const ping = room.makeAction<Ping>("ping");
  ping.onMessage = (d, { peerId }) => {
    if (isPing(d, "ping")) void ping.send({ k: "pong", t: d.t }, { target: peerId });
  };
  answering = { id, room };
}

export function stopAnswering(): void {
  if (!answering) return;
  const room = answering.room;
  answering = null;
  void room.leave().catch(() => {});
}

/* ---------- the visitor side ---------- */

export interface ProbeResult {
  ok: boolean;
  ms: number;
  at: number;
}

const RESULT_TTL_MS = 120_000;
const RETRY_MS = 2500;
const DEFAULT_TIMEOUT_MS = 20_000;

const cache = new Map<string, ProbeResult>();
const running = new Map<string, Promise<ProbeResult>>();

/** a recent result for this room, if any */
export function probeResult(id: string): ProbeResult | null {
  const r = cache.get(id);
  return r && Date.now() - r.at < RESULT_TTL_MS ? r : null;
}

function runProbe(id: string, timeout: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let done = false;
    const room = sideRoom(id);
    const ping = room.makeAction<Ping>("ping");
    const end = (ok: boolean, ms = 0) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(again);
      void room.leave().catch(() => {});
      const r = { ok, ms, at: Date.now() };
      cache.set(id, r);
      running.delete(id);
      resolve(r);
    };
    const send = (pid?: string) =>
      void ping.send({ k: "ping", t: performance.now() }, pid ? { target: pid } : undefined).catch(() => {});
    ping.onMessage = (d) => {
      if (isPing(d, "pong")) end(true, Math.max(1, Math.round(performance.now() - d.t)));
    };
    room.onPeerJoin = (pid) => send(pid);
    // other visitors may be in the side room too; only the host answers
    const again = setInterval(() => send(), RETRY_MS);
    const timer = setTimeout(() => end(false), timeout);
  });
}

/** ping a listed room; resolves with the round trip, or ok:false after `timeout` */
export function probe(id: string, timeout = DEFAULT_TIMEOUT_MS): Promise<ProbeResult> {
  const hit = probeResult(id);
  if (hit) return Promise.resolve(hit);
  const pending = running.get(id);
  if (pending) return pending;
  const p = runProbe(id, timeout);
  running.set(id, p);
  return p;
}
