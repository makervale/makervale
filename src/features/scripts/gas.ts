/**
 * Gas: what scripts spend, per second. Every interpreter step costs, and so does every action that is sent to
 * everyone in the room (a move, a colour, a word, a note); every physical ball costs too, for its simulation and
 * its updates. Each script has its own allowance, and all of them together the room's. A script that has spent
 * its allowance rests until the next second: nothing breaks, nothing freezes.
 */

export const ROOM_GAS = 300_000;
export const SCRIPT_GAS = 60_000;
/** an action everyone in the room receives */
export const ACTION_GAS = 400;
/** a physical ball, per second */
export const BODY_GAS = 4_000;

export class Gas {
  private used = new Map<string, number>();
  private roomUsed = 0;
  private second = -1;
  private lastShare = 0;
  private lastUsed = new Map<string, number>();

  /** a new second refills every allowance; the balls take their share first */
  tick(t: number, bodies: number): void {
    const s = Math.floor(t);
    if (s === this.second) return;
    this.second = s;
    this.lastShare = Math.min(1, this.roomUsed / ROOM_GAS);
    this.lastUsed = this.used;
    this.used = new Map();
    // however many balls there are, half of each second stays for the scripts
    this.roomUsed = Math.min(bodies * BODY_GAS, ROOM_GAS / 2);
  }

  tired(id: string): boolean {
    return this.roomUsed >= ROOM_GAS || (this.used.get(id) ?? 0) >= SCRIPT_GAS;
  }

  spend(id: string, amount: number): void {
    if (amount <= 0) return;
    this.used.set(id, (this.used.get(id) ?? 0) + amount);
    this.roomUsed += amount;
  }

  /** how much of the room's gas the last whole second used (0…1), for the room's meter */
  roomShare(): number {
    return this.lastShare;
  }

  /** how much of the room's gas this script used the last whole second (0…1), for the owner's list */
  scriptShare(id: string): number {
    return Math.min(1, (this.lastUsed.get(id) ?? 0) / ROOM_GAS);
  }

  /** scripts that rested this second, for the Script tab */
  tiredScripts(): string[] {
    return [...this.used].filter(([, n]) => n >= SCRIPT_GAS).map(([id]) => id);
  }
}
