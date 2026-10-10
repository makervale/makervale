/** Mount every feature; the order matters only where noted. */
import * as avatarWindow from "@/features/avatar-window";
import type { Identity } from "@/features/avatar-window";
import * as buildWindow from "@/features/build-window";
import * as cameraWindow from "@/features/camera-window";
import * as chat from "@/features/chat";
import * as files from "@/features/files";
import * as gestures from "@/features/gestures";
import * as liveTool from "@/features/live-tool";
import * as manipulators from "@/features/manipulators";
import * as menubar from "@/features/menubar";
import * as multiplayer from "@/features/multiplayer-window";
import * as phoneMode from "@/features/phone-mode";
import * as pieMenu from "@/features/pie-menu";
import { touchable } from "@/features/scripts";
import { CATEGORIES } from "@/features/tools";
import * as sound from "@/features/sound";
import * as terms from "@/features/terms";
import * as toolsPanel from "@/features/tools-panel";
import * as touchControls from "@/features/touch-controls";
import { Prefs } from "@/features/tools-panel/prefs";
import { thumbnail } from "@/render/preview/thumbs";
import * as viewportInput from "@/features/viewport-input";
import type { Renderer } from "@/render/renderer";
import { initSpinners } from "@/ui/spinner";
import { initWindows } from "@/ui/window";
import type { Bodies } from "./bodies";
import type { Core } from "./core";
import { loadWorld } from "@/world/migrate";
import { sampleWorld } from "@/world/sample";

export interface Mounted {
  manip: manipulators.Manipulators;
  live: liveTool.LiveTool;
  camera: cameraWindow.CameraWindow;
  sound: sound.Sound;
}

export function mountFeatures(core: Core, renderer: Renderer, bodies: Bodies, who: Identity): Mounted {
  const stage = document.getElementById("stage")!;
  const base = { ...core, renderer, stage };
  const manip = manipulators.mount(base);
  const live = liveTool.mount({ ...base, manip });
  const camera = cameraWindow.mount({ store: core.store, camera: renderer.camera, framing: renderer.framing, stage });
  const sounds = sound.mount({
    bus: core.bus,
    avatar: bodies.avatar,
    darkness: () => renderer.sky.darkness,
    isBody: (id) => !!core.store.byId(id)?.body,
    distanceTo: (id) => {
      const o = core.store.byId(id);
      const me = bodies.avatar.state.pos;
      return o ? Math.hypot(o.pos[0] - me.x, o.pos[1] - me.y, o.pos[2] - me.z) : Infinity;
    },
    // read each time: leaving a room starts a new chat list
    lastChat: () => bodies.session.net.chat[bodies.session.net.chat.length - 1],
  });
  const mounted = { manip, live, camera, sound: sounds };
  mountViewport(core, renderer, bodies, mounted);
  mountBuilding(core, renderer, bodies, manip);
  mountPeople(core, bodies, who);
  touchControls.mount({ bus: core.bus, avatar: bodies.avatar, stage });
  phoneMode.mount();
  // windows and spinners bind to the DOM the features just created
  initWindows();
  initSpinners();
  // on top of everything, until accepted: the privacy note and terms (the phone notice waits underneath)
  terms.mount(() => {});
  return mounted;
}

function mountViewport(core: Core, renderer: Renderer, bodies: Bodies, m: Mounted): void {
  const stage = document.getElementById("stage")!;
  const scripts = { touchable, touch: (id: string) => core.bus.emit("object:touched", { id }) };
  viewportInput.mount({ ...core, renderer, stage, avatar: bodies.avatar, live: m.live, manip: m.manip, scripts });
  pieMenu.mount({ ...core, renderer, avatar: bodies.avatar, scripts });
  // after the renderer: the wireframe follows the renderer's own world:changed handling
  menubar.mount({ ...core, renderer });
}

function mountBuilding(core: Core, renderer: Renderer, bodies: Bodies, manip: manipulators.Manipulators): void {
  const prefs = new Prefs();
  toolsPanel.mount({ ...core, renderer, categories: CATEGORIES, prefs });
  const scripts = {
    scriptError: (id: string) => bodies.runtime.error(id) || null,
    restartScript: (id: string) => bodies.runtime.restart(id),
    touchable,
  };
  const room = { canIBuild: () => bodies.session.canIBuild() };
  buildWindow.mount({ ...core, renderer, manipulators: manip, scripts, room, pins: prefs, thumbnail });
  files.mount({ ...core, renderer, loadWorld, sampleWorld });
}

function mountPeople(core: Core, bodies: Bodies, who: Identity): void {
  const { bus } = core;
  const { session, avatar, models } = bodies;
  chat.mount({ bus, net: session.net, session, avatar });
  const avatarPort = {
    setAvatarLook: (name: string, look: Identity["look"]) => avatar.setAvatarLook(name, look),
    myFigure: () => avatar.myFigure(),
    addLocalModel: (buf: ArrayBuffer) => models.addLocalModel(buf),
  };
  avatarWindow.mount({ bus, identity: who, avatar: avatarPort, session });
  gestures.mount({ bus });
  const check = { checkConnectivity: session.checkConnection };
  const lobby = session;
  multiplayer.mount({ bus, session, lobby, reachability: session, ice: session, check, identity: who });
}
