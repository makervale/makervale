/**
 * A thin wrapper over a Trystero room: typed actions in, raw messages out. Browsers connect directly (WebRTC data
 * channels); public Nostr relays only introduce them to each other.
 */
import { joinRoom, selfId } from "trystero/nostr";
import type { DataPayload, JoinRoomConfig, MessageAction, RequestAction, Room } from "trystero/nostr";
import { iceOptions } from "./ice";
import { roomRelays } from "./relays";
import type { ActionName, FileRequest, Messages } from "./messages";
import { ACTION_NAMES } from "./messages";

export const APP_ID = "piaskownica-mesh-editor-v1";
/** snapshots of big scenes and avatar files are large */
const MAX_RECEIVE_BYTES = 96 * 1024 * 1024;

export { selfId };

/** the Trystero config every room (and side room) uses */
export function roomConfig(extra: Partial<JoinRoomConfig> = {}): JoinRoomConfig {
  return { appId: APP_ID, relayConfig: { urls: roomRelays() }, ...iceOptions(), ...extra };
}

export type MessageHandler = (data: unknown, from: string) => void;

export interface TransportHooks {
  /** false for peers whose messages must be ignored (the host removed them) */
  accept(peerId: string): boolean;
  onJoinError(reason: string): void;
  onPeerJoin(peerId: string): void;
  onPeerLeave(peerId: string): void;
  /** the bytes of the avatar file I wear, by hash; throws when I don't have it */
  fileRequest(hash: string): Promise<ArrayBuffer>;
}

export interface Transport {
  send<N extends ActionName>(name: N, data: Messages[N], target?: string): void;
  on<N extends ActionName>(name: N, handler: MessageHandler): void;
  /** ask one peer for an avatar file; resolves with whatever they sent (checked by the caller) */
  requestFile(hash: string, from: string, timeoutMs: number): Promise<unknown>;
  /** close the connection to a peer */
  drop(peerId: string): void;
  leave(): Promise<void>;
}

type AnyAction = MessageAction<DataPayload>;

function makeActions(room: Room): Record<ActionName, AnyAction> {
  const out = {} as Record<ActionName, AnyAction>;
  for (const name of ACTION_NAMES) out[name] = room.makeAction(name);
  return out;
}

const HASH = /^[0-9a-f]{64}$/;

function makeFileAction(room: Room, hooks: TransportHooks): RequestAction<FileRequest, ArrayBuffer> {
  return room.makeAction<FileRequest, ArrayBuffer>("file", {
    kind: "request",
    onRequest: (d) => {
      const hash = d && typeof d.h === "string" && HASH.test(d.h) ? d.h : null;
      if (!hash) throw new Error("not here");
      return hooks.fileRequest(hash);
    },
  });
}

export function openTransport(roomId: string, hooks: TransportHooks): Transport {
  const room = joinRoom(roomConfig({ maxReceiveBytes: MAX_RECEIVE_BYTES }), roomId, {
    onJoinError: (d) => hooks.onJoinError(d && d.error ? String(d.error).slice(0, 120) : "unknown reason"),
  });
  const actions = makeActions(room);
  const file = makeFileAction(room, hooks);
  room.onPeerJoin = (pid) => hooks.onPeerJoin(pid);
  room.onPeerLeave = (pid) => hooks.onPeerLeave(pid);
  return {
    send(name, data, target) {
      // our message types are plain JSON; Trystero's payload type is structural and can't see that
      const sent = actions[name].send(data as unknown as DataPayload, target ? { target } : undefined);
      // a peer that just left (or was removed) rejects the send; it will get the next hello if it comes back
      Promise.resolve(sent).catch(() => {});
    },
    on(name, handler) {
      actions[name].onMessage = (data, { peerId }) => {
        if (hooks.accept(peerId)) handler(data, peerId);
      };
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
