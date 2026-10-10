/**
 * The meeting point of the script runtime (features/scripts) and the room. Scripts run on one peer, the authority
 * (see authority.ts); the others only replay what it sends. The runtime implements `ScriptBridge`; the session hands
 * it `ScriptNetHooks` through `connect` once, when the session is created.
 */
import type { Quat, Vec3 } from "@/lib/vec";
import type { Fx } from "./sanitize";

export type { Fx };

export interface Placement {
  pos: Vec3;
  quat: Quat;
  size: Vec3;
}

/** what net calls on the runtime */
export interface ScriptBridge {
  /** called once by createSession */
  connect(hooks: ScriptNetHooks): void;
  /** someone touched a scripted object (only called on the authority) */
  touch(id: string, who: string): void;
  /** chat was said in the room; scripts may listen */
  hear(text: string, who: string): void;
  /** the authority started a smooth move: replay it here */
  applyEffect(fx: Fx): void;
  /** where an object will end up if a script is moving it right now, else null */
  settledTarget(id: string): Placement | null;
  /** who runs scripts may have changed: start or stop running them */
  resync(): void;
  /** the scene was replaced: drop all running scripts and moves */
  reset(): void;
}

/** what the runtime calls on net */
export interface ScriptNetHooks {
  /** should scripts run on this computer? (always outside rooms) */
  isAuthority(): boolean;
  /** a script started a smooth move (authority only): everyone replays it */
  onMoved(fx: Fx): void;
  /** scripts changed these objects (authority only): everyone gets them */
  onChanged(ids: string[]): void;
  /** an object's script said something */
  onSay(obj: { id: string; name: string }, text: string): void;
  /** an object's script played a note: everyone in the room hears it */
  onPlay(id: string, note: number, instrument: string): void;
  /** you touched a scripted object while someone else is the authority */
  onForwardTouch(id: string): void;
  /** everyone's name and position, for scripts that look for people nearby */
  avatars(): { name: string; pos: Vec3 }[];
  /**
   * Wrap every scene change the runtime makes itself (commands.apply for script effects and each frame of a
   * smooth move). Net sends local edits by listening to world:changed; the runtime's changes reach peers through
   * onMoved/onChanged instead, and every peer animates moves on its own, so echoing these would flood the room
   * and make objects jump mid-move.
   */
  quietly(change: () => void): void;
}
