/** Making, changing and checking signed room rules. The key store is injected so this stays free of browser APIs. */
import { MAX_LIST } from "./model";
import type { KeyStore, RoomKind, Rules, RulesChange } from "./model";
import { loadOwnerKey, saveOwnerKey } from "./owner-key";
import { newSecretKey, publicKeyHex, sign, verify } from "./signing";
import { wellFormedRules } from "./validate";

export interface RulesApi {
  /** a new room: make an owner key and the first rules */
  newRules(room: string, host: string, kind: RoomKind): Promise<Rules>;
  /** null unless we hold the owner key */
  updateRules(r: Rules, change: RulesChange): Promise<Rules | null>;
  /** rules that arrived from someone else: well-formed, signed by their owner, for this room */
  checkRules(x: unknown, room: string): Promise<Rules | null>;
  ownsRules(r: Rules | null): boolean;
  /** the owner key behind these rules, if we hold it (it also signs what the owner keeps on the relays) */
  ownerSecret(r: Rules | null): Uint8Array | null;
}

export async function checkRules(x: unknown, room: string): Promise<Rules | null> {
  const r = wellFormedRules(x, room);
  return r && verify(r) ? r : null;
}

const capped = (list: string[]) => [...new Set(list)].slice(-MAX_LIST);

export function createRules(keys: KeyStore): RulesApi {
  function ownerSecret(r: Rules | null): Uint8Array | null {
    const k = r && loadOwnerKey(keys, r.room);
    return k && publicKeyHex(k) === r.owner ? k : null;
  }

  async function newRules(room: string, host: string, kind: RoomKind): Promise<Rules> {
    const secretKey = newSecretKey();
    saveOwnerKey(keys, room, secretKey);
    const owner = publicKeyHex(secretKey);
    // strangers watch until the owner lets them build; friends build from the start
    const build = kind === "public" ? "owner" : "all";
    const lists = { allow: [], deny: [], banned: [] };
    return sign({ room, owner, host, kind, build, ...lists, keep: false, ver: 1 }, secretKey);
  }

  async function updateRules(r: Rules, change: RulesChange): Promise<Rules | null> {
    const k = ownerSecret(r);
    if (!k) return null;
    // a public room's code was listed for anyone: it can't become private again
    const next = { ...r, ...change, ver: r.ver + 1, ...(r.kind === "public" ? { kind: r.kind } : {}) };
    const lists = { allow: capped(next.allow), deny: capped(next.deny), banned: capped(next.banned) };
    // nothing of a public room is kept on the relays
    const keep = next.kind === "private" && next.keep;
    const unsigned = { room: r.room, owner: r.owner, host: next.host, kind: next.kind, build: next.build };
    return sign({ ...unsigned, ...lists, keep, ver: next.ver }, k);
  }

  return { newRules, updateRules, checkRules, ownsRules: (r) => ownerSecret(r) !== null, ownerSecret };
}
