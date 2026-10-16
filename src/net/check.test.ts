import { describe, expect, it, vi } from "vitest";
import { classifyNat, parseMapping } from "./check-probes";

vi.mock("./relays", () => ({ probeRelay: vi.fn(), relayProbe: vi.fn(), relaysReady: vi.fn() }));
const { verdictOf } = await import("./check");

const srflx = (addr: string, port: number, rport: number) =>
  `candidate:1 1 udp 1677729535 ${addr} ${port} typ srflx raddr 0.0.0.0 rport ${rport} generation 0`;

describe("NAT test", () => {
  it("reads server-reflexive UDP candidates only", () => {
    expect(parseMapping(srflx("1.2.3.4", 5000, 6000))).toEqual({ addr: "1.2.3.4", port: 5000, base: 6000 });
    expect(parseMapping("candidate:1 1 udp 2122260223 192.168.1.2 6000 typ host generation 0")).toBeNull();
    expect(parseMapping("candidate:1 1 tcp 1 1.2.3.4 5000 typ srflx raddr 0.0.0.0 rport 6000")).toBeNull();
  });

  it("tells a stable mapping from a symmetric one", () => {
    expect(classifyNat([])).toBe("blocked");
    const stable = [
      { addr: "1.2.3.4", port: 5000, base: 6000 },
      { addr: "1.2.3.4", port: 5000, base: 6000 },
    ];
    expect(classifyNat(stable)).toBe("ok");
    const sym = [
      { addr: "1.2.3.4", port: 5000, base: 6000 },
      { addr: "1.2.3.4", port: 5001, base: 6000 },
    ];
    expect(classifyNat(sym)).toBe("sym");
  });
});

describe("verdict", () => {
  it("blocked without relays, limited without WebRTC, good otherwise (strict routers go through the relays)", () => {
    expect(verdictOf(0, true, "ok", false).verdict).toBe("blocked");
    expect(verdictOf(3, false, "ok", false).verdict).toBe("limited");
    expect(verdictOf(3, true, "sym", false).verdict).toBe("good");
    expect(verdictOf(3, true, "sym", false).summary).toContain("through the public relays");
    expect(verdictOf(3, true, "blocked", false).verdict).toBe("good");
    expect(verdictOf(3, true, "sym", true).verdict).toBe("good");
    expect(verdictOf(3, true, "ok", false).verdict).toBe("good");
  });
});
