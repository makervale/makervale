/** One WebSocket per relay for the room list, reconnecting quietly while someone still listens on it. */
import { reportSockets } from "./relays";

export type RelayMessage = unknown[];
export type RelayHandler = (msg: RelayMessage) => void;

/** handlers get this when the socket (re)opens, so they can send their subscriptions again */
export const OPENED = "__open";

interface Conn {
  url: string;
  ws: WebSocket | null;
  open: boolean;
  queue: string[];
  handlers: Set<RelayHandler>;
  retryMs: number;
}

const FIRST_RETRY_MS = 2000;
const MAX_RETRY_MS = 60_000;

const conns = new Map<string, Conn>();
let tried = 0;

function tellStatus(): void {
  reportSockets([...conns.values()].filter((c) => c.open).length, tried);
}

/** the connection to a relay, opened on first use */
export function relaySocket(url: string): Conn {
  let c = conns.get(url);
  if (c) return c;
  c = { url, ws: null, open: false, queue: [], handlers: new Set(), retryMs: FIRST_RETRY_MS };
  conns.set(url, c);
  connect(c);
  return c;
}

export const existingSocket = (url: string): Conn | undefined => conns.get(url);

function connect(c: Conn): void {
  tried++;
  let ws: WebSocket;
  try {
    ws = new WebSocket(c.url);
  } catch {
    tellStatus();
    return;
  }
  c.ws = ws;
  ws.onopen = () => onOpen(c, ws);
  ws.onmessage = (e) => onMessage(c, e);
  ws.onclose = () => onClose(c);
  ws.onerror = () => tellStatus();
}

function onOpen(c: Conn, ws: WebSocket): void {
  c.open = true;
  c.retryMs = FIRST_RETRY_MS;
  for (const m of c.queue.splice(0)) ws.send(m);
  for (const h of c.handlers) h([OPENED]);
  tellStatus();
}

function onMessage(c: Conn, e: MessageEvent): void {
  let m: unknown;
  try {
    m = JSON.parse(String(e.data));
  } catch {
    return;
  }
  if (!Array.isArray(m)) return;
  for (const h of c.handlers) h(m);
}

function onClose(c: Conn): void {
  const wasOpen = c.open;
  c.open = false;
  c.ws = null;
  if (wasOpen) tellStatus();
  if (!c.handlers.size) {
    conns.delete(c.url);
    return;
  }
  c.retryMs = Math.min(c.retryMs * 2, MAX_RETRY_MS);
  setTimeout(() => connect(c), c.retryMs);
}

/** send now, or as soon as the socket opens */
export function relaySend(c: Conn, m: unknown): void {
  const s = JSON.stringify(m);
  if (c.open && c.ws) c.ws.send(s);
  else c.queue.push(s);
}
