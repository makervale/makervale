/**
 * How browsers reach each other directly: STUN tells each side its public address. When strict routers make a
 * direct connection impossible, the room's relay channel carries the traffic instead (channel/), with no setup.
 * A TURN server of your own (Settings › Advanced in the Multiplayer window) is optional: it carries such connections
 * smoother than the relays. No free TURN server works without an account, so none is built in.
 */
import type { BaseRoomConfig } from "trystero/nostr";
import { queryParam } from "./query";

export interface Turn {
  urls: string[];
  username: string;
  credential: string;
  name?: string;
}

export interface TurnPrefs {
  custom: Turn | null;
}

export const STUN = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"];

const PREFS_KEY = "pias.turn";
const MAX_URLS = 6;
const MAX_FIELD = 200;

export function turnPrefs(): TurnPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (saved && typeof saved === "object") return { custom: validTurn(saved.custom) };
  } catch {
    /* no storage here: no relay */
  }
  return { custom: null };
}

export function setTurnPrefs(prefs: TurnPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* the relay is still used this session */
  }
}

function urlList(raw: unknown): string[] {
  const parts = Array.isArray(raw) ? raw : String(raw || "").split(/[\s,]+/);
  return parts
    .map((u: unknown) => String(u).trim())
    .filter((u: string) => /^turns?:[^\s]{3,200}$/.test(u))
    .slice(0, MAX_URLS);
}

/** a TURN setting someone typed or saved, or null if it isn't one */
export function validTurn(x: unknown): Turn | null {
  if (!x || typeof x !== "object") return null;
  const raw = x as Record<string, unknown>;
  const urls = urlList(raw.urls);
  if (!urls.length) return null;
  return {
    urls,
    username: String(raw.username || "").slice(0, MAX_FIELD),
    credential: String(raw.credential || "").slice(0, MAX_FIELD),
  };
}

/** the relays to use now: yours, if you set one */
export function turnServers(): Turn[] {
  const prefs = turnPrefs();
  return prefs.custom ? [{ ...prefs.custom, name: "Your relay" }] : [];
}

/** `?ice=none` disables STUN and TURN (for testing on one machine) */
const noIce = queryParam("ice") === "none";

export type IceOptions = Pick<BaseRoomConfig, "rtcConfig" | "turnConfig">;

/** options for Trystero's joinRoom */
export function iceOptions(): IceOptions {
  if (noIce) return { rtcConfig: { iceServers: [] } };
  return { turnConfig: turnServers().map((t) => ({ urls: t.urls, username: t.username, credential: t.credential })) };
}

const RELAY_ANSWER_MS = 10_000;

/** ask a TURN relay for an address; a "relay" candidate means it is reachable and accepts the login */
export function relayAnswers(t: Turn, ms = RELAY_ANSWER_MS): Promise<boolean> {
  if (typeof RTCPeerConnection === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: t.urls, username: t.username, credential: t.credential }],
        iceTransportPolicy: "relay",
      });
    } catch {
      resolve(false);
      return;
    }
    let done = false;
    const end = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      pc.close();
      resolve(ok);
    };
    const timer = setTimeout(() => end(false), ms);
    pc.createDataChannel("r");
    pc.onicecandidate = (e) => {
      if (!e.candidate) end(false);
      else if (/ typ relay /.test(e.candidate.candidate)) end(true);
    };
    pc.createOffer()
      .then((o) => pc.setLocalDescription(o))
      .catch(() => end(false));
  });
}
