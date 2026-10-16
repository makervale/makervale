/**
 * Direct connections (WebRTC data channels) through a Trystero room. Public Nostr relays introduce the browsers;
 * the room id and the password that encrypts the handshake come from the room code (room-keys.ts), so the relays
 * learn neither the code nor the addresses in the handshake.
 */
import { joinRoom, selfId } from "trystero/nostr";
import type { DataPayload, JoinRoomConfig, MessageAction, RequestAction, Room } from "trystero/nostr";
import { iceOptions } from "./ice";
import type { ActionName, FileRequest } from "./messages";
import { ACTION_NAMES } from "./messages";
import { queryParam } from "./query";
import { roomRelays } from "./relays";
import type { RoomKeys } from "./room-keys";

export const APP_ID = "piaskownica-mesh-editor-v1";
/** snapshots of big scenes and avatar files are large */
const MAX_RECEIVE_BYTES = 96 * 1024 * 1024;
/** `?direct=none` makes no direct connections: everything goes through the relays (to test that path) */
export const NO_DIRECT = queryParam("direct") === "none";

export { selfId };

/** the Trystero config every room (and side room) uses */
export function roomConfig(extra: Partial<JoinRoomConfig> = {}): JoinRoomConfig {
  return { appId: APP_ID, relayConfig: { urls: roomRelays() }, ...iceOptions(), ...extra };
}

export interface DirectHooks {
  onJoin(peerId: string): void;
  onLeave(peerId: string): void;
  onJoinError(reason: string): void;
  deliver(name: ActionName, data: unknown, from: string): void;
  /** the bytes of the avatar file I wear, by hash; throws when I don't have it */
  fileRequest(hash: string): Promise<ArrayBuffer>;
}

export interface Direct {
  send(name: ActionName, data: unknown, target?: string): void;
  requestFile(hash: string, from: string, timeoutMs: number): Promise<unknown>;
  drop(peerId: string): void;
  leave(): Promise<void>;
}

type AnyAction = MessageAction<DataPayload>;
const HASH = /^[0-9a-f]{64}$/;

function fileAction(room: Room, hooks: DirectHooks): RequestAction<FileRequest, ArrayBuffer> {
  return room.makeAction<FileRequest, ArrayBuffer>("file", {
    kind: "request",
    onRequest: (d) => {
      const hash = d && typeof d.h === "string" && HASH.test(d.h) ? d.h : null;
      if (!hash) throw new Error("not here");
      return hooks.fileRequest(hash);
    },
  });
}

const nobody: Direct = {
  send: () => {},
  requestFile: () => Promise.reject(new Error("no direct connections")),
  drop: () => {},
  leave: async () => {},
};

export function openDirect(keys: RoomKeys, hooks: DirectHooks): Direct {
  if (NO_DIRECT) return nobody;
  const config = roomConfig({ maxReceiveBytes: MAX_RECEIVE_BYTES, password: keys.password });
  const room = joinRoom(config, keys.topic, {
    onJoinError: (d) => hooks.onJoinError(d && d.error ? String(d.error).slice(0, 120) : "unknown reason"),
  });
  const actions = {} as Record<ActionName, AnyAction>;
  for (const name of ACTION_NAMES) {
    actions[name] = room.makeAction(name);
    actions[name].onMessage = (data, { peerId }) => hooks.deliver(name, data, peerId);
  }
  const file = fileAction(room, hooks);
  room.onPeerJoin = (pid) => hooks.onJoin(pid);
  room.onPeerLeave = (pid) => hooks.onLeave(pid);
  return {
    send(name, data, target) {
      // our message types are plain JSON; Trystero's payload type is structural and can't see that
      const sent = actions[name].send(data as DataPayload, target ? { target } : undefined);
      // a peer that just left (or was removed) rejects the send; it will get the next hello if it comes back
      Promise.resolve(sent).catch(() => {});
    },
    requestFile: (hash, from, timeoutMs) => file.request({ h: hash }, { target: from, timeoutMs }),
    drop(peerId) {
      try {
        room.getPeers()[peerId]?.close();
      } catch {
        /* gone already */
      }
    },
    async leave() {
      try {
        await room.leave();
      } catch {
        /* already gone */
      }
    },
  };
}
