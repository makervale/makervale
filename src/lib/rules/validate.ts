/** Shape checks for rules that arrived from a peer, before any crypto is spent on them. */
import { MAX_LIST, MAX_NAME } from "./model";
import type { BuildPolicy, Rules, RoomKind } from "./model";
import { HEX_KEY, HEX_SIG } from "./signing";

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

const isHex = (v: unknown, pattern: RegExp): v is string => typeof v === "string" && pattern.test(v);

const isName = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_NAME;

const isKind = (v: unknown): v is RoomKind => v === "private" || v === "public";

const isBuildPolicy = (v: unknown): v is BuildPolicy => v === "all" || v === "owner";

const isVersion = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1;

const isList = (v: unknown): v is string[] => Array.isArray(v) && v.length <= MAX_LIST && v.every(isName);

/** well-formed and for this room; the signature is not checked here */
const wellSigned = (x: Record<string, unknown>) =>
  isHex(x.owner, HEX_KEY) && isHex(x.sig, HEX_SIG) && isName(x.host) && isVersion(x.ver);

const wellSet = (x: Record<string, unknown>) =>
  isKind(x.kind) && isBuildPolicy(x.build) && typeof x.keep === "boolean" && [x.allow, x.deny, x.banned].every(isList);

export function wellFormedRules(x: unknown, room: string): Rules | null {
  if (!isRecord(x) || x.room !== room || !wellSigned(x) || !wellSet(x)) return null;
  const { owner, sig, host, kind, build, allow, deny, banned, keep, ver } = x as unknown as Rules;
  return { room, owner, host, kind, build, allow, deny, banned, keep, ver, sig };
}
