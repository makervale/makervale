/**
 * What the Multiplayer window needs besides the room itself: the public room list, "can I reach that room?", your
 * TURN relay, the connection test and how the signalling relays are doing.
 */
import type { Report } from "./check";
import { checkConnectivity } from "./check";
import type { RoomAd } from "./discovery";
import { browse } from "./discovery";
import type { Turn, TurnPrefs } from "./ice";
import { relayAnswers, setTurnPrefs, turnPrefs, turnServers, validTurn } from "./ice";
import type { ProbeResult } from "./reachability";
import { probe, probeResult } from "./reachability";
import { allowNetwork, networkAllowed, revokeNetwork } from "./online";
import { onRelayStatus, relayStatus } from "./relays";

export interface RelayStatus {
  /** relay sockets open right now */
  reachable: number;
  tried: number;
  /** relays chosen for rooms */
  total: number;
  /** the startup probe of the relay pool is still running */
  probing: boolean;
}

export interface ConnectionApi {
  /** live list of publicly listed rooms; returns a function that stops listening */
  browse(onList: (rooms: RoomAd[]) => void): () => void;
  /** ping a listed room through its host; resolves with the round trip, or ok:false after `timeoutMs` */
  probe(id: string, timeoutMs?: number): Promise<ProbeResult>;
  /** a recent ping result for this room, if any */
  probeResult(id: string): ProbeResult | null;
  turnPrefs(): TurnPrefs;
  setTurnPrefs(prefs: TurnPrefs): void;
  /** a TURN setting someone typed, or null if it isn't one */
  validTurn(x: unknown): Turn | null;
  /** the TURN relays in use (yours, if you set one) */
  turnServers(): Turn[];
  /** does this TURN relay answer and accept the login? */
  testTurn(t: Turn, timeoutMs?: number): Promise<boolean>;
  /** "Will rooms work for me?"; `onProgress` gets the report as each check finishes */
  checkConnection(onProgress: (r: Report) => void): Promise<Report>;
  relayStatus(): RelayStatus;
  onRelayStatus(listener: () => void): () => void;
  /** has the person agreed to go online (the privacy note in the Multiplayer window)? */
  networkAllowed(): boolean;
  allowNetwork(): void;
  revokeNetwork(): void;
}

export function connectionApi(): ConnectionApi {
  return {
    browse,
    probe,
    probeResult,
    turnPrefs,
    setTurnPrefs,
    validTurn,
    turnServers,
    testTurn: relayAnswers,
    checkConnection: checkConnectivity,
    relayStatus,
    onRelayStatus,
    networkAllowed,
    allowNetwork,
    revokeNetwork,
  };
}
