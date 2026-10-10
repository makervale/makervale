import { describe, expect, it } from "vitest";
import { createNetState, newPeer } from "@/net/state";
import type { RoomSession } from "./port";
import { roomHTML } from "./room-view";

function session(opts: { host: boolean; canBuild: boolean }): RoomSession {
  const net = createNetState("me");
  net.id = "abc123xyz";
  net.name = "Plaza";
  net.synced = true;
  net.peers.set("p1", { ...newPeer("p1"), name: "Ann <3", synced: true });
  return {
    net,
    hostId: () => (opts.host ? "me" : "p1"),
    amHost: () => opts.host,
    canIBuild: () => opts.canBuild,
  } as Partial<RoomSession> as RoomSession;
}

const me = { name: "Ola", look: { shirt: "#3d6fa8" } };

describe("the window in a room", () => {
  it("gives the host the build switch and a Remove button per person", () => {
    const html = roomHTML(me, session({ host: true, canBuild: true }), "");
    expect(html).toContain('id="mp-build-all" checked');
    expect(html.match(/data-kick=/g)?.length).toBe(1);
    expect(html).toContain('Ola <i>(you)</i> <em class="host-tag">host</em>');
    expect(html).toContain("Ann &lt;3");
    expect(html).toContain("Here now <span>2</span>");
  });

  it("tells others when only the host can build, and marks the host", () => {
    const html = roomHTML(me, session({ host: false, canBuild: false }), "");
    expect(html).toContain('class="mp-host locked"');
    expect(html).not.toContain("data-kick");
    expect(html).toContain('Ann &lt;3 <em class="host-tag">host</em>');
  });
});
