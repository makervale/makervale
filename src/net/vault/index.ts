/**
 * "Keep online": a private room's encrypted copy on the public relays, so the room opens when nobody is in it.
 * Only if its owner chose it (the signed "keep" rule); otherwise nothing of the room is stored there. One browser
 * per room saves it: the one running the scripts, or the owner where only the owner builds. A save goes out a few
 * seconds after the scene changed (at most every half minute), and when that browser leaves.
 */
import { restingWorld } from "@/world/resting";
import type { Ctx } from "../context";
import { amAuthority, changed, inRoom } from "../context";
import { roomKeys } from "../room-keys";
import { amOwner } from "../rules";
import { kindOf } from "../state";
import { ownerOnly } from "./manifest";
import type { VaultCopy } from "./read";
import { readVault } from "./read";
import { repairVault } from "./repair";
import type { SaveRequest } from "./write";
import { writeVault } from "./write";

export type { VaultCopy };
export { peekVault } from "./read";
export { forgetVault } from "./forget";

const DELAY_S = 8;
const MIN_GAP_S = 30;
/** read-repair waits a while, a different while in every browser, so visitors don't all repair at once */
const REPAIR_AFTER_MS = 10_000;
const REPAIR_SPREAD_MS = 30_000;

interface Saver {
  savedVer: number;
  /** seconds since the first change not saved yet; -1 when nothing waits */
  dirtyFor: number;
  sinceSave: number;
  saving: Promise<boolean> | null;
}
const savers = new WeakMap<Ctx, Saver>();
const freshSaver = (): Saver => ({ savedVer: -1, dirtyFor: -1, sinceSave: MIN_GAP_S, saving: null });

function saverOf(ctx: Ctx): Saver {
  let s = savers.get(ctx);
  if (!s) savers.set(ctx, (s = freshSaver()));
  return s;
}

export function vaultWriter(ctx: Ctx): boolean {
  const n = ctx.net;
  if (!inRoom(ctx) || !n.synced || !n.rules?.keep || kindOf(n) !== "private") return false;
  return ownerOnly(n.rules) ? amOwner(ctx) : amAuthority(ctx);
}

/** taken at once: the scene may be replaced while the save goes on */
function saveRequest(ctx: Ctx): SaveRequest | null {
  const n = ctx.net;
  if (!n.rules) return null;
  const ownerSecret = ownerOnly(n.rules) ? ctx.rules.ownerSecret(n.rules) : null;
  if (ownerOnly(n.rules) && !ownerSecret) return null;
  const world = structuredClone(restingWorld(ctx.deps.store.world));
  return { world, name: n.name, ver: n.ver, rules: n.rules, ownerSecret };
}

async function save(ctx: Ctx, s: Saver): Promise<boolean> {
  const n = ctx.net;
  const room = n.id;
  const req = saveRequest(ctx);
  if (!req) return false;
  s.savedVer = req.ver;
  n.vault = { ...n.vault, state: "saving" };
  changed(ctx);
  const relays = await writeVault(await roomKeys(room), req).catch(() => 0);
  if (n.id !== room) return relays > 0;
  n.vault = relays ? { state: "saved", at: Date.now(), relays } : { ...n.vault, state: "failed" };
  if (!relays) s.savedVer = -1;
  // on the relays now: our changes are no longer ours alone
  else if (n.ver === req.ver) n.pending = false;
  changed(ctx);
  return relays > 0;
}

export function saveVaultNow(ctx: Ctx): Promise<boolean> {
  const s = saverOf(ctx);
  if (!vaultWriter(ctx)) return Promise.resolve(false);
  if (s.saving) return s.saving;
  s.dirtyFor = -1;
  s.sinceSave = 0;
  s.saving = save(ctx, s).finally(() => (s.saving = null));
  return s.saving;
}

/** leaving: save what changed since the last save (it goes on in the background) */
export function flushVault(ctx: Ctx): Promise<boolean> {
  return ctx.net.ver !== saverOf(ctx).savedVer ? saveVaultNow(ctx) : Promise.resolve(false);
}

export function vaultTick(ctx: Ctx, dt: number): void {
  const s = saverOf(ctx);
  s.sinceSave += dt;
  if (!vaultWriter(ctx) || s.saving) return;
  if (ctx.net.ver === s.savedVer) {
    s.dirtyFor = -1;
    return;
  }
  s.dirtyFor = s.dirtyFor < 0 ? 0 : s.dirtyFor + dt;
  if (s.dirtyFor >= DELAY_S && s.sinceSave >= MIN_GAP_S) void saveVaultNow(ctx);
}

/** a room just entered: its first save waits for a change, not for the half-minute gap */
export const resetVault = (ctx: Ctx): void => void savers.set(ctx, freshSaver());

/** `owner`: who we know owns the room, if anyone */
export async function loadVault(ctx: Ctx, code: string, owner: string | null): Promise<VaultCopy | null> {
  ctx.net.vault = { ...ctx.net.vault, state: "loading" };
  changed(ctx);
  const keys = await roomKeys(code);
  const copy = await readVault(keys, owner).catch(() => null);
  if (ctx.net.id !== code) return copy;
  ctx.net.vault = copy ? { state: "saved", at: copy.manifest.at, relays: 0 } : { ...ctx.net.vault, state: "none" };
  changed(ctx);
  if (copy) {
    const renew = !ownerOnly(copy.manifest.rules);
    setTimeout(
      () => {
        if (ctx.net.id === code) void repairVault(keys, copy.seen, renew).catch(() => 0);
      },
      REPAIR_AFTER_MS + Math.random() * REPAIR_SPREAD_MS,
    );
  }
  return copy;
}
