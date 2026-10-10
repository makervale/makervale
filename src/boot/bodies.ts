/** Your avatar, the other people's bodies, and the room session that connects them. */
import { AvatarController } from "@/avatar/controller";
import { PeerBodyStore } from "@/avatar/peer-bodies";
import { velocityOf } from "@/avatar/snapshot";
import { VrmLoader } from "@/avatar/vrm";
import type { Identity } from "@/features/avatar-window";
import * as physicsFeature from "@/features/physics";
import type { Physics } from "@/features/physics";
import * as scripts from "@/features/scripts";
import type { Mover } from "@/lib/physics";
import type { ScriptRuntime } from "@/features/scripts";
import { createSession } from "@/net";
import type { Session } from "@/net";
import type { Renderer } from "@/render/renderer";
import { toast } from "@/ui/toast";
import type { Core } from "./core";

export interface Bodies {
  models: VrmLoader;
  avatar: AvatarController;
  peers: PeerBodyStore;
  runtime: ScriptRuntime;
  physics: Physics;
  session: Session;
}

const localKeys = {
  get: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  set: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // without storage you stay host only until the page closes
    }
  },
};

/** your avatar as the physics sees it: feet and velocity, or nothing while seated */
function moverOf(avatar: AvatarController): Mover | null {
  const s = avatar.snapshot();
  return s.sitting ? null : { pos: s.pos, vel: velocityOf(s) };
}

export function createBodies(core: Core, renderer: Renderer, who: Identity): Bodies {
  const { store, bus, commands } = core;
  const models = new VrmLoader();
  const avatar = new AvatarController({ renderer, bus, store, models, notice: (t) => toast(t) });
  avatar.setAvatarLook(who.name, who.look);
  const peers = new PeerBodyStore({ scene: renderer.scene, bubbles: renderer.bubbles, models, store, self: avatar });
  const runtime = scripts.mount({ store, bus, commands, myName: () => who.name });
  const physics = physicsFeature.mount({ store, bus, commands, views: renderer.views, self: () => moverOf(avatar) });
  const session = createSession({
    store,
    bus,
    commands,
    peers,
    localAvatar: () => avatar.snapshot(),
    scripts: runtime,
    physics,
    selfName: () => who.name,
    selfLook: () => who.look,
    keyStore: localKeys,
  });
  models.setRemoteFetch((hash) => session.fetchFile(hash));
  bus.on("gesture:play", ({ name }) => session.gesture(name));
  return { models, avatar, peers, runtime, physics, session };
}
