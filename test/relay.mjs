// A tiny local Nostr relay for testing rooms offline: NIP-01 REQ/EVENT/CLOSE with kinds, authors, ids, #tags,
// since/until/limit; ephemeral kinds (20000–29999) are only forwarded, replaceable kinds (30000–39999) keep the latest.
import { WebSocketServer } from "ws";
const port = +(process.argv[2] || 7777);
const wss = new WebSocketServer({ port });
const stored = [];
const subs = new Map(); // ws -> Map(subId -> filters)
const matches = (ev, f) => {
  if (f.ids && !f.ids.includes(ev.id)) return false;
  if (f.authors && !f.authors.includes(ev.pubkey)) return false;
  if (f.kinds && !f.kinds.includes(ev.kind)) return false;
  if (f.since && ev.created_at < f.since) return false;
  if (f.until && ev.created_at > f.until) return false;
  for (const k of Object.keys(f))
    if (k[0] === "#") {
      const vals = f[k];
      if (!ev.tags.some((t) => t[0] === k.slice(1) && vals.includes(t[1]))) return false;
    }
  return true;
};
wss.on("connection", (ws) => {
  subs.set(ws, new Map());
  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (m[0] === "REQ") {
      const [, id, ...filters] = m;
      subs.get(ws).set(id, filters);
      const out = stored.filter((ev) => filters.some((f) => matches(ev, f)));
      for (const ev of out.slice(-(filters[0].limit || 500))) ws.send(JSON.stringify(["EVENT", id, ev]));
      ws.send(JSON.stringify(["EOSE", id]));
    } else if (m[0] === "CLOSE") subs.get(ws).delete(m[1]);
    else if (m[0] === "EVENT") {
      const ev = m[1];
      ws.send(JSON.stringify(["OK", ev.id, true, ""]));
      if (ev.kind >= 30000 && ev.kind < 40000) {
        const d = (ev.tags.find((t) => t[0] === "d") || [])[1] || "";
        const i = stored.findIndex(
          (x) =>
            x.kind === ev.kind && x.pubkey === ev.pubkey && ((x.tags.find((t) => t[0] === "d") || [])[1] || "") === d,
        );
        if (i >= 0) stored.splice(i, 1);
        stored.push(ev);
      } else if (!(ev.kind >= 20000 && ev.kind < 30000)) stored.push(ev);
      for (const [c, s] of subs)
        for (const [id, fs] of s)
          if (fs.some((f) => matches(ev, f)) && c.readyState === 1) c.send(JSON.stringify(["EVENT", id, ev]));
    }
  });
  ws.on("close", () => subs.delete(ws));
});
console.log("relay on ws://localhost:" + port);
