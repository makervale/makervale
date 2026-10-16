/** What the Multiplayer window needs: the session (rooms, Gallery, connection), the bus, and who you are. */
import type { Bus } from "@/app/bus";
import type { Session } from "@/net";

export type { Session };
export type {
  Changer,
  Check,
  PeerState,
  PublicRoom,
  RelayStatus,
  Report,
  SavedRoomInfo,
  Turn,
  TurnPrefs,
  VaultStatus,
  WorldHead,
} from "@/net";

export type CheckState = "ok" | "warn" | "bad" | "run";

/** who you are (the Avatar window owns it) */
export interface Me {
  readonly name: string;
  readonly look: { readonly shirt: string };
}

export interface MultiplayerDeps {
  bus: Bus;
  session: Session;
  identity: Me;
  /** where the window goes; #stage by default */
  stage?: HTMLElement;
}
