/** The Multiplayer window as its parts see it: the deps, its body, and what it has learned so far. */
import type { MultiplayerDeps, Report, RoomAd, SavedRoomInfo } from "./port";

export interface MpState {
  /** public rooms, as last listed */
  rooms: RoomAd[];
  /** rooms saved in this browser */
  mine: SavedRoomInfo[];
  /** the last connection test */
  report: Report | null;
  checking: boolean;
  /** stops listening for public rooms; null when not listening */
  stopBrowse: (() => void) | null;
}

export interface MpWindow {
  deps: MultiplayerDeps;
  body: HTMLElement;
  state: MpState;
  render(): void;
}

export const emptyState = (): MpState => ({ rooms: [], mine: [], report: null, checking: false, stopBrowse: null });
