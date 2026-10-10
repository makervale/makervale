/**
 * What the Multiplayer window needs from net, named as in the old net/session.ts, lobby.ts, probe.ts, ice.ts and
 * check.ts. main.ts passes the real session, discovery, reachability, ICE settings and connection test.
 */
import type { Bus } from "@/app/bus";
import type { RoomAd } from "@/net/discovery";
import type { Turn, TurnPrefs } from "@/net/ice";
import type { ProbeResult } from "@/net/reachability";
import type { SavedRoomInfo } from "@/net/saved-rooms";
import type { NetState } from "@/net/state";

export type { RoomAd, ProbeResult, SavedRoomInfo, Turn, TurnPrefs };

/** the room you are in (old net/session.ts) */
export interface RoomSession {
  readonly net: NetState;
  inRoom(): boolean;
  /** open a room with the current scene; returns its code */
  host(name: string, listPublicly: boolean): string;
  join(id: string, name?: string): Promise<void>;
  reopen(id: string): Promise<boolean>;
  leave(): Promise<void>;
  setPublic(listed: boolean): void;
  setBuildRule(everyone: boolean): Promise<void>;
  kick(peerId: string): Promise<void>;
  amHost(): boolean;
  hostId(): string;
  canIBuild(): boolean;
  savedRooms(): Promise<SavedRoomInfo[]>;
  forgetRoom(id: string): Promise<void>;
}

export interface RelayStatus {
  /** relay sockets open */
  reachable: number;
  /** relays chosen by the probe */
  total: number;
  probing: boolean;
}

/** the public room list (old net/lobby.ts) */
export interface Lobby {
  browse(onList: (rooms: RoomAd[]) => void): () => void;
  relayStatus(): RelayStatus;
  onRelayStatus(listener: () => void): () => void;
  /** has the person agreed to go online this time? Before that the window shows the risks and nothing is contacted */
  networkAllowed(): boolean;
  allowNetwork(): void;
  /** consent withdrawn: offline again, asked anew before going online */
  revokeNetwork(): void;
}

/** pinging a listed room before offering it (old net/probe.ts) */
export interface Reachability {
  probe(id: string): Promise<ProbeResult>;
  probeResult(id: string): ProbeResult | null;
}

/** your own TURN relay (old net/ice.ts) */
export interface IceSettings {
  turnPrefs(): TurnPrefs;
  setTurnPrefs(prefs: TurnPrefs): void;
  validTurn(x: unknown): Turn | null;
}

export type CheckState = "ok" | "warn" | "bad" | "run";

export interface Check {
  name: string;
  state: CheckState;
  detail: string;
  /** one line per relay, for the details */
  list?: string;
}

export interface Report {
  checks: Check[];
  verdict: "good" | "limited" | "blocked";
  summary: string;
}

/** "will rooms work from here?" (old net/check.ts) */
export interface ConnectionCheck {
  checkConnectivity(onProgress: (report: Report) => void): Promise<Report>;
}

/** who you are (the Avatar window owns it) */
export interface Me {
  readonly name: string;
  readonly look: { readonly shirt: string };
}

export interface MultiplayerDeps {
  bus: Bus;
  session: RoomSession;
  lobby: Lobby;
  reachability: Reachability;
  ice: IceSettings;
  check: ConnectionCheck;
  identity: Me;
  /** where the window goes; #stage by default */
  stage?: HTMLElement;
}
