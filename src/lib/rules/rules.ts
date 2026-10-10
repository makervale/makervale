/** Making, changing and checking signed room rules. The key store is injected so this stays free of
 *  browser APIs; the net layer passes localStorage. */
import { MAX_BANNED } from "./model";
import type { KeyStore, Rules, RulesChange } from "./model";
import { loadOwnerKey, saveOwnerKey } from "./owner-key";
import { newSecretKey, publicKeyHex, sign, verify } from "./signing";
import { wellFormedRules } from "./validate";

export interface RulesApi {
  /** a new room: make an owner key and the first rules */
  newRules(room: string, host: string): Promise<Rules>;
  /** change the rules; null unless we hold the owner key */
  updateRules(r: Rules, change: RulesChange): Promise<Rules | null>;
  /** rules that arrived from someone else: well-formed, signed by their owner, for this room */
  checkRules(x: unknown, room: string): Promise<Rules | null>;
  /** do we hold the key that owns these rules? */
  ownsRules(r: Rules | null): boolean;
}

export async function checkRules(x: unknown, room: string): Promise<Rules | null> {
  const r = wellFormedRules(x, room);
  return r && verify(r) ? r : null;
}

export function createRules(keys: KeyStore): RulesApi {
  function ownerKey(r: Rules): Uint8Array | null {
    const k = loadOwnerKey(keys, r.room);
    return k && publicKeyHex(k) === r.owner ? k : null;
  }

  async function newRules(room: string, host: string): Promise<Rules> {
    const secretKey = newSecretKey();
    saveOwnerKey(keys, room, secretKey);
    const owner = publicKeyHex(secretKey);
    return sign({ room, owner, host, build: "all", banned: [], ver: 1 }, secretKey);
  }

  async function updateRules(r: Rules, change: RulesChange): Promise<Rules | null> {
    const k = ownerKey(r);
    if (!k) return null;
    const banned = (change.banned ?? r.banned).slice(-MAX_BANNED);
    const next = { room: r.room, owner: r.owner, host: change.host ?? r.host, build: change.build ?? r.build };
    return sign({ ...next, banned, ver: r.ver + 1 }, k);
  }

  const ownsRules = (r: Rules | null): boolean => r !== null && ownerKey(r) !== null;

  return { newRules, updateRules, checkRules, ownsRules };
}
