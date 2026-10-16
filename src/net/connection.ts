/** What the Multiplayer window needs besides rooms: consent, your TURN server, the connection test, the relays. */
import type { Report } from "./check";
import { checkConnectivity } from "./check";
import type { Turn, TurnPrefs } from "./ice";
import { relayAnswers, setTurnPrefs, turnPrefs, turnServers, validTurn } from "./ice";
import { allowNetwork, networkAllowed, restoreConsent, revokeNetwork } from "./online";
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
  /** after the terms were accepted: go online if consent was given before; true if online */
  restoreConsent(): boolean;
  revokeNetwork(): void;
}

export function connectionApi(): ConnectionApi {
  return {
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
    restoreConsent,
    revokeNetwork,
  };
}
