/** Shape checks for rules that arrived from a peer, before any crypto is spent on them. */
import { MAX_BANNED, MAX_NAME } from "./model";
import type { BuildPolicy, Rules } from "./model";
import { HEX_KEY, HEX_SIG } from "./signing";

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

const isHex = (v: unknown, pattern: RegExp): v is string => typeof v === "string" && pattern.test(v);

const isName = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_NAME;

const isBuildPolicy = (v: unknown): v is BuildPolicy => v === "all" || v === "host";

const isVersion = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1;

const isBannedList = (v: unknown): v is string[] => Array.isArray(v) && v.length <= MAX_BANNED && v.every(isName);

/** well-formed and for this room; the signature is not checked here */
export function wellFormedRules(x: unknown, room: string): Rules | null {
  if (!isRecord(x) || x.room !== room) return null;
  const { owner, sig, host, build, ver, banned } = x;
  if (!isHex(owner, HEX_KEY) || !isHex(sig, HEX_SIG)) return null;
  if (!isName(host) || !isBuildPolicy(build) || !isVersion(ver)) return null;
  if (!isBannedList(banned)) return null;
  return { room, owner, host, build, banned, ver, sig };
}
