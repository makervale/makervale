/** The WebRTC parts of the connection test: a loopback inside the page, and how public STUN servers see us. */
import { STUN } from "./ice";

const LOOPBACK_MS = 6000;
const NAT_MS = 7000;

/** do two connections inside this page manage to talk to each other? */
export async function loopback(ms = LOOPBACK_MS): Promise<boolean> {
  if (typeof RTCPeerConnection === "undefined") return false;
  const a = new RTCPeerConnection({ iceServers: [] });
  const b = new RTCPeerConnection({ iceServers: [] });
  try {
    a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate).catch(() => {});
    b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate).catch(() => {});
    const channel = a.createDataChannel("t");
    const ok = new Promise<boolean>((resolve) => {
      b.ondatachannel = (e) => (e.channel.onmessage = (m) => resolve(m.data === "ping"));
      channel.onopen = () => channel.send("ping");
      setTimeout(() => resolve(false), ms);
    });
    await a.setLocalDescription(await a.createOffer());
    await b.setRemoteDescription(a.localDescription!);
    await b.setLocalDescription(await b.createAnswer());
    await a.setRemoteDescription(b.localDescription!);
    return await ok;
  } catch {
    return false;
  } finally {
    a.close();
    b.close();
  }
}

/** our public address and port as one STUN server saw them, and the local port they map from */
export interface Mapping {
  addr: string;
  port: number;
  base: number;
}

/** a server-reflexive UDP candidate, as a mapping; null for any other candidate */
export function parseMapping(candidate: string): Mapping | null {
  const typ = / typ (\w+)/.exec(candidate)?.[1];
  if (typ !== "srflx" || !/ udp /i.test(candidate)) return null;
  const fields = candidate.split(" ");
  const base = +(/ rport (\d+)/.exec(candidate)?.[1] || 0);
  return { addr: fields[4], port: +fields[5], base };
}

function askStun(url: string, ms: number, out: Mapping[]): Promise<void> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: url }] });
  pc.createDataChannel("n");
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      pc.close();
      resolve();
    };
    const timer = setTimeout(finish, ms);
    pc.onicecandidate = (e) => {
      if (!e.candidate) return finish();
      const m = parseMapping(e.candidate.candidate);
      if (m) out.push(m);
    };
    pc.createOffer()
      .then((o) => pc.setLocalDescription(o))
      .catch(finish);
  });
}

/** public address mappings seen by different STUN servers (one connection each, so each reports its own view) */
export async function natMappings(ms = NAT_MS): Promise<Mapping[]> {
  const out: Mapping[] = [];
  if (typeof RTCPeerConnection === "undefined") return out;
  await Promise.all(STUN.map((url) => askStun(url, ms, out)));
  return out;
}

export type NatKind = "ok" | "sym" | "blocked";

/** symmetric NAT: the router picks a new public port for every destination */
export function classifyNat(mapped: Mapping[]): NatKind {
  if (!mapped.length) return "blocked";
  const byBase = new Map<number, Set<string>>();
  for (const m of mapped) {
    const key = m.base || 0;
    if (!byBase.has(key)) byBase.set(key, new Set());
    byBase.get(key)!.add(m.addr + ":" + m.port);
  }
  const portsDiffer = new Set(mapped.map((m) => m.port)).size > 1;
  const oneBase = new Set(mapped.map((m) => m.base)).size === 1;
  const sym = [...byBase.values()].some((s) => s.size > 1) || (portsDiffer && oneBase);
  return sym ? "sym" : "ok";
}
