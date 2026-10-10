/**
 * Camera controls window (#camfl): hold an orbit / pan / zoom button to keep moving, drag the zoom slider, or jump
 * to a preset view of the selection (or of everything). Mount it before initWindows() so its close button and
 * header are wired; call `update(dt)` every frame.
 */
import type { Store } from "@/app/store";
import type { CameraController } from "@/render/camera/controller";
import type { Framing } from "@/render/camera/framing";
import type { PresetView } from "@/render/camera/presets";
import { distanceToSlider, sliderToDistance } from "./zoom-scale";
import { cameraWindowHtml } from "./view";

export interface CameraWindowDeps {
  store: Store;
  camera: CameraController;
  framing: Framing;
  stage: HTMLElement;
}

export interface CameraWindow {
  update(dt: number): void;
}

/** a held button: what it does and in which direction */
interface Hold {
  kind: string;
  a: number;
  c: number;
}

const ORBIT_RATE = 1.4; // rad/s
const PAN_RATE_PX = 260; // px/s
const ZOOM_PER_S = 0.35; // distance factor per second held

export function mount(deps: CameraWindowDeps): CameraWindow {
  deps.stage.insertAdjacentHTML("beforeend", cameraWindowHtml());
  const win = document.getElementById("camfl")!;
  const slider = win.querySelector<HTMLInputElement>("#zoomslider")!;
  let hold: Hold | null = null;
  win.addEventListener("pointerdown", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-cam]");
    if (!b) return;
    const [kind, a, c] = b.dataset.cam!.split(":");
    hold = { kind, a: Number(a), c: Number(c ?? 0) };
    e.preventDefault();
    const up = () => {
      hold = null;
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointerup", up);
  });
  win.addEventListener("click", (e) => {
    const p = (e.target as HTMLElement).closest<HTMLElement>("[data-preset]");
    if (p) showPreset(deps, p.dataset.preset!);
  });
  slider.addEventListener("input", () => deps.camera.setDistance(sliderToDistance(Number(slider.value))));
  return {
    update(dt: number) {
      if (hold) moveHeld(deps.camera, hold, dt);
      else if (document.activeElement !== slider) slider.value = String(distanceToSlider(deps.camera.offset.length()));
    },
  };
}

function showPreset(deps: CameraWindowDeps, preset: string): void {
  const selected = deps.store.selected();
  const objs = selected.length ? selected : deps.store.visibleObjects();
  if (preset === "home") deps.framing.home(objs);
  else deps.framing.preset(preset as PresetView, objs);
}

function moveHeld(camera: CameraController, { kind, a, c }: Hold, dt: number): void {
  if (kind === "orbit") {
    if (a) camera.orbitAround(a * ORBIT_RATE * dt);
    if (c) camera.orbitOver(c * dt);
  } else if (kind === "pan") camera.pan(a * PAN_RATE_PX * dt, c * PAN_RATE_PX * dt);
  else camera.zoomIn(Math.pow(ZOOM_PER_S, a * dt));
}
