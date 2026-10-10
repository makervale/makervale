import { afterAll, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";

// a pool of fake relays: two answer, one answers slowly, one never answers, one refuses
const POOL = [7801, 7802, 7803, 7804, 7805].map((p) => "ws://127.0.0.1:" + p);
const servers: WebSocketServer[] = [];
const up = (port: number, delay = 0) =>
  new Promise<void>((res) => {
    const verifyClient = delay ? (_i: any, cb: any) => setTimeout(() => cb(true), delay) : undefined;
    const s = new WebSocketServer({ port, verifyClient });
    servers.push(s);
    s.on("listening", res);
  });
vi.mock("trystero/nostr", () => ({ defaultRelayUrls: POOL }));
(globalThis as any).location = { search: "?pool=" + POOL.join(",") };

afterAll(() => servers.forEach((s) => s.close()));

describe("relay pool probe", () => {
  it("uses the relays that answer, in pool order, and ignores the rest", async () => {
    await up(7801);
    await up(7802);
    await up(7803, 1500);
    const relays = await import("./relays");
    const got = await relays.relaysReady();
    expect(got.length).toBe(3);
    expect(got.every((u) => /780[123]/.test(u))).toBe(true);
    const st = relays.relayStatus();
    expect(st.probing).toBe(false);
    expect(st.total).toBe(3);
    const pr = relays.relayProbe();
    expect(pr.answered.length).toBe(3);
    expect(pr.tried).toBe(5);
  }, 20000);
});
