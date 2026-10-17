/** The session's part about who may do what in the room, and the owner's tools. */
import type { Ctx } from "./context";
import { askToBuild, canAskAgainIn } from "./moderation/ask";
import type { Changer } from "./moderation";
import { changers, rewind, rewindReach, showingChanges, toggleChanges, undoPerson } from "./moderation";
import { kick, letBuild, lockdown, setEveryoneBuilds } from "./owner-tools";
import { goPublic, keepOnline } from "./room-actions";
import { amOwner, canBuild, canIBuild, ownerId, personOf } from "./rules";
import type { Route } from "./transport";

export interface OwnerApi {
  canIBuild(): boolean;
  canBuild(peerId: string): boolean;
  amOwner(): boolean;
  /** the owner's peer id in their current visit ("" if unknown) */
  ownerId(): string;
  /** how the rules name this peer (their key in this room) */
  personOf(peerId: string): string;
  routeOf(peerId: string): Route | null;
  /** 0 normally; higher when the relays asked the room's channel to slow down */
  relaySlowdown(): number;
  setEveryoneBuilds(on: boolean): Promise<boolean>;
  letBuild(peerId: string, yes: boolean): Promise<boolean>;
  lockdown(): Promise<boolean>;
  kick(peerId: string): Promise<boolean>;
  /** for good: a public room never becomes private again (its code was listed); a copy can */
  makePublic(): Promise<void>;
  keepOnline(on: boolean): Promise<void>;
  /** people whose changes this session can be undone (the owner's log) */
  changers(): Changer[];
  /** resolves with the number of objects put back */
  undoPerson(who: string): number;
  /** select what they changed and bring it into view, or let it go if it is selected; how many were selected */
  toggleChanges(who: string): number;
  /** is exactly what they changed selected now? */
  showingChanges(who: string): boolean;
  rewind(minutes: number): number;
  /** how many minutes back the scene can be rewound */
  rewindReach(): number;
  /** false if asked too recently, or the owner isn't here */
  askToBuild(): boolean;
  canAskAgainIn(): number;
}

export function ownerApi(ctx: Ctx): OwnerApi {
  return {
    canIBuild: () => canIBuild(ctx),
    canBuild: (pid) => canBuild(ctx, pid),
    amOwner: () => amOwner(ctx),
    ownerId: () => ownerId(ctx),
    personOf: (pid) => personOf(ctx, pid),
    routeOf: (pid) => ctx.link?.routeOf(pid) ?? null,
    relaySlowdown: () => ctx.link?.relaySlowdown() ?? 0,
    setEveryoneBuilds: (on) => setEveryoneBuilds(ctx, on),
    letBuild: (pid, yes) => letBuild(ctx, pid, yes),
    lockdown: () => lockdown(ctx),
    kick: (pid) => kick(ctx, pid),
    makePublic: () => goPublic(ctx),
    keepOnline: (on) => keepOnline(ctx, on),
    changers: () => changers(ctx),
    undoPerson: (who) => undoPerson(ctx, who),
    toggleChanges: (who) => toggleChanges(ctx, who),
    showingChanges: (who) => showingChanges(ctx, who),
    rewind: (minutes) => rewind(ctx, minutes),
    rewindReach: () => rewindReach(ctx),
    askToBuild: () => askToBuild(ctx),
    canAskAgainIn: () => canAskAgainIn(ctx),
  };
}
