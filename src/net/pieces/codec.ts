/**
 * How a scene's pieces look on the relays. A private room's copy is sealed with the room's key (deterministically,
 * so an unchanged piece is the same event and isn't sent again); a world in the Gallery is public and stays plain.
 * Either way a piece is named by the hash of its bytes, which whoever fetches it checks.
 */
import type { RoomKeys } from "../room-keys";
import { seal, unseal } from "../seal";

export interface Codec {
  /** pieces this browser knows are on the relays are remembered per scope */
  scope: string;
  encode(plain: Uint8Array): Promise<Uint8Array>;
  decode(stored: Uint8Array): Promise<Uint8Array | null>;
}

export const roomCodec = (keys: RoomKeys): Codec => ({
  scope: "room:" + keys.code,
  encode: (plain) => seal(keys, plain, true),
  decode: (stored) => unseal(keys, stored),
});

export const plainCodec = (author: string): Codec => ({
  scope: "world:" + author,
  encode: async (plain) => plain,
  decode: async (stored) => stored,
});
