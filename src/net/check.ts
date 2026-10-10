/**
 * "Will rooms work for me?" checks what a shared room needs, from this browser:
 *  1. the public relays answer (to find rooms and to introduce peers);
 *  2. WebRTC works in this page at all (two connections inside the page talk to each other);
 *  3. what kind of network you're behind, using public STUN servers: whether your router gives a stable public
 *     address (direct connections work, no public IP or port forwarding needed) or a different one per destination
 *     (symmetric NAT: connections with some people would need a TURN relay);
 *  4. whether your TURN relay answers (it carries the traffic when a direct connection can't be made).
 */
import type { NatKind } from "./check-probes";
import { classifyNat, loopback, natMappings } from "./check-probes";
import { relayAnswers, turnServers } from "./ice";
import { probeRelay, relayProbe, relaysReady } from "./relays";

export interface Check {
  name: string;
  state: "ok" | "warn" | "bad" | "run";
  detail: string;
  /** one relay per line, with its round trip */
  list?: string;
}

export interface Report {
  checks: Check[];
  verdict: "good" | "limited" | "blocked";
  summary: string;
  build?: string;
}

declare const __BUILD__: string;

const RELAY_CHECK_MS = 6000;
const RELAYS = "Signalling relays";
const WEBRTC = "WebRTC in this page";
const NAT = "Your network (NAT)";
const TURN = "Traffic relay (TURN)";

type Tell = () => void;

const hostOf = (url: string): string => url.replace(/^wss?:\/\//, "");

/** the relays this page found at startup; their round trips are measured again here */
async function checkRelays(checks: Check[], tell: Tell): Promise<number> {
  const using = await relaysReady();
  const times = await Promise.all(using.map((u) => probeRelay(u, RELAY_CHECK_MS)));
  const ok = times.filter((t): t is number => t !== null);
  const pr = relayProbe();
  const list = [...pr.answered.map((a) => `✓ ${hostOf(a.url)} ${a.ms} ms`), ...pr.failed.map((u) => `✕ ${hostOf(u)}`)];
  const detail = ok.length
    ? `${pr.answered.length} of ${pr.tried} answer; rooms use ${using.length} of them (fastest ${Math.min(...ok)} ms). ` +
      "These only introduce people to each other."
    : `none of ${pr.tried} answer: you are offline, a firewall or browser extension blocks WebSockets, ` +
      "or this page may not connect out";
  let state: Check["state"] = "bad";
  if (ok.length) state = ok.length >= 2 ? "ok" : "warn";
  checks[0] = { name: RELAYS, state, detail, list: list.join("\n") };
  tell();
  return ok.length;
}

async function checkWebRTC(checks: Check[], tell: Tell): Promise<boolean> {
  const ok = await loopback();
  checks[1] = ok
    ? { name: WEBRTC, state: "ok", detail: "direct data channels work" }
    : {
        name: WEBRTC,
        state: "bad",
        detail: "blocked or unsupported here (try another browser, or open the page outside an embedding)",
      };
  tell();
  return ok;
}

const NAT_DETAIL: Record<NatKind, (addr: string) => Check> = {
  blocked: () => ({
    name: NAT,
    state: "warn",
    detail: "no public address found: UDP/STUN looks blocked, so only people on your own network could connect",
  }),
  sym: (addr) => ({
    name: NAT,
    state: "warn",
    detail:
      `public address ${addr}, but your router picks a new port for every destination (symmetric NAT). ` +
      "You can connect to most people, not to others with the same kind of router.",
  }),
  ok: (addr) => ({
    name: NAT,
    state: "ok",
    detail: `public address ${addr}, stable mapping: others can reach you directly. No public IP or port forwarding needed.`,
  }),
};

async function checkNat(checks: Check[], tell: Tell): Promise<NatKind> {
  const mapped = await natMappings();
  const kind = classifyNat(mapped);
  checks[2] = NAT_DETAIL[kind](mapped[0]?.addr ?? "");
  tell();
  return kind;
}

async function checkTurn(checks: Check[], tell: Tell): Promise<boolean> {
  const t = turnServers()[0];
  const ok = t ? await relayAnswers(t) : false;
  let detail =
    "none set. Only needed when a direct connection is impossible (strict routers on both sides); " +
    "add your own below if you need one.";
  if (t && ok) detail = "your relay answers: when a direct connection isn't possible, traffic goes through it.";
  if (t && !ok) {
    detail =
      "your relay doesn't answer from here: check the address, username and password, or your network may block it.";
  }
  checks[3] = { name: TURN, state: ok ? "ok" : "warn", detail };
  tell();
  return ok;
}

type Verdict = Pick<Report, "verdict" | "summary">;

/** what the four checks mean together */
export function verdictOf(relays: number, webrtc: boolean, nat: NatKind, turn: boolean): Verdict {
  if (relays && webrtc && nat !== "ok" && turn) {
    const summary =
      "All good: your router is strict, but the relay covers it, so people can join you and you can join them. " +
      "No public IP or open ports needed.";
    return { verdict: "good", summary };
  }
  if (!relays) return { verdict: "blocked", summary: "Rooms can’t work from here: the public relays are unreachable." };
  if (!webrtc) return { verdict: "blocked", summary: "Rooms can’t work from here: this page can’t use WebRTC." };
  if (nat === "sym") {
    const summary =
      "Your router is strict (symmetric NAT): you can connect to people on ordinary home networks, but not to " +
      "people on strict ones (mobile data, many offices) unless one side adds a TURN relay. A free one takes a " +
      "few minutes: see Relay server below.";
    return { verdict: "limited", summary };
  }
  if (nat === "blocked") {
    const summary =
      "Your network blocks the STUN servers, so direct connections may only work with people on your own network. " +
      "A TURN relay (see below) gets through most such networks.";
    return { verdict: "limited", summary };
  }
  return {
    verdict: "good",
    summary: "All good: you can host and join rooms. Hosting needs no public IP and no open ports.",
  };
}

/** run all four checks at once; `onProgress` gets a fresh report whenever one finishes */
export async function checkConnectivity(onProgress: (r: Report) => void): Promise<Report> {
  const checks: Check[] = [
    { name: RELAYS, state: "run", detail: "trying the relay pool…" },
    { name: WEBRTC, state: "run", detail: "testing…" },
    { name: NAT, state: "run", detail: "asking public STUN servers…" },
    { name: TURN, state: "run", detail: turnServers().length ? "contacting your relay…" : "none set" },
  ];
  const build = typeof __BUILD__ === "string" ? __BUILD__ : "dev";
  const report: Report = { checks, verdict: "good", summary: "Checking…", build };
  const tell = () => onProgress({ ...report, checks: checks.map((c) => ({ ...c })) });
  tell();
  const [relays, webrtc, nat, turn] = await Promise.all([
    checkRelays(checks, tell),
    checkWebRTC(checks, tell),
    checkNat(checks, tell),
    checkTurn(checks, tell),
  ]);
  Object.assign(report, verdictOf(relays, webrtc, nat, turn));
  tell();
  return report;
}
