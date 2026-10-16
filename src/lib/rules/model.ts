/**
 * A room's rules, set by its owner. There is no server to trust, so they are signed: whoever opens a room gets a
 * key, every browser checks the signature, and the first signed rules a browser sees for a room fix who its owner
 * is. A newer version (higher number) from the same owner replaces older rules.
 *
 * People are named by their key for this room (net/person.ts), so a rule about someone still holds after they
 * reload the page.
 */

/** private: whoever has the link; public: anyone, from the list of public rooms, while the owner is in */
export type RoomKind = "private" | "public";

/** whether people the owner didn't name in allow or deny may build */
export type BuildPolicy = "all" | "owner";

export interface Rules {
  room: string;
  /** hex x-only public key of whoever opened the room */
  owner: string;
  /** the owner's peer id in their current visit */
  host: string;
  kind: RoomKind;
  build: BuildPolicy;
  allow: string[];
  deny: string[];
  banned: string[];
  /** a private room's encrypted copy stays on the relays, so it opens when nobody is in it */
  keep: boolean;
  ver: number;
  /** hex BIP340 Schnorr signature over the other fields */
  sig: string;
}

export type UnsignedRules = Omit<Rules, "sig">;

export type RulesChange = Partial<Pick<Rules, "host" | "kind" | "build" | "allow" | "deny" | "banned" | "keep">>;

/** where owner keys live between sessions; the net layer passes localStorage here */
export interface KeyStore {
  get(name: string): string | null;
  set(name: string, value: string): void;
}

export const MAX_LIST = 200;
export const MAX_NAME = 80;
