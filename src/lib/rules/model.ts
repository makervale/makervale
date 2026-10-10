/** Room rules set by the room's host: whether others may build, and who has been removed. There is no
 *  server to trust, so the rules are signed: whoever opens a room gets a key, every browser checks the
 *  signature, and the first signed rules a browser sees for a room fix who its owner is. A newer version
 *  (higher number) from the same owner replaces older rules. */

export type BuildPolicy = "all" | "host";

export interface Rules {
  room: string;
  /** hex x-only public key of whoever opened the room */
  owner: string;
  /** peer id of the current host */
  host: string;
  build: BuildPolicy;
  banned: string[];
  ver: number;
  /** hex BIP340 Schnorr signature over the other fields */
  sig: string;
}

export type UnsignedRules = Omit<Rules, "sig">;

export type RulesChange = Partial<Pick<Rules, "build" | "banned" | "host">>;

/** where the owner key lives between sessions; the net layer passes localStorage here */
export interface KeyStore {
  get(name: string): string | null;
  set(name: string, value: string): void;
}

export const MAX_BANNED = 200;
export const MAX_NAME = 64;
