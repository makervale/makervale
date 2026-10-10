/** The net layer's public face: create the session, and the types the UI and main.ts need. */
export { createSession } from "./session";
export type { HostApi, PeopleApi, RoomApi, Session } from "./session";
export type { ConnectionApi, RelayStatus } from "./connection";
export type { SessionDeps } from "./context";
export type { ChatLine, NetState, PeerState } from "./state";
export type { AvatarSnapshot, PeerBodies, Speaker } from "./peers";
export type { Placement, ScriptBridge, ScriptNetHooks, Fx } from "./scripts-bridge";
export type { BodyState, PhysicsBridge, PhysicsNetHooks } from "./physics-bridge";
export type { SavedRoomInfo } from "./saved-rooms";
export type { RoomAd } from "./discovery";
export type { ProbeResult } from "./reachability";
export type { Turn, TurnPrefs } from "./ice";
export type { Check, Report } from "./check";
