/** The Multiplayer window as its parts see it: the deps, its body, and what it has learned so far. */
import type { MultiplayerDeps, PublicRoom, Report, SavedRoomInfo, WorldHead } from "./port";

export type MpTab = "rooms" | "public" | "gallery" | "settings";

export interface MpState {
  tab: MpTab;
  /** a room code from an invite link, waiting for a yes */
  invite: string | null;
  mine: SavedRoomInfo[];
  publicRooms: PublicRoom[];
  /** null until first loaded */
  gallery: WorldHead[] | null;
  myWorlds: WorldHead[];
  galleryBusy: boolean;
  /** the publish form is open */
  publishing: boolean;
  report: Report | null;
  checking: boolean;
  stopBrowse: (() => void) | null;
}

export interface MpWindow {
  deps: MultiplayerDeps;
  body: HTMLElement;
  state: MpState;
  render(): void;
}

export const emptyState = (): MpState => ({
  tab: "rooms",
  invite: null,
  mine: [],
  publicRooms: [],
  gallery: null,
  myWorlds: [],
  galleryBusy: false,
  publishing: false,
  report: null,
  checking: false,
  stopBrowse: null,
});
