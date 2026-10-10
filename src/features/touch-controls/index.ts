/**
 * Touch controls for phones and tablets: a joystick to walk (bottom left) and up / down buttons while flying.
 * They only show on touch screens (CSS `pointer: coarse`), so desktop is unchanged.
 */
import type { Bus } from "@/app/bus";
import { readStick } from "./stick-math";

/** your avatar (avatar/controller.ts) */
export interface TouchAvatarPort {
  readonly flying: boolean;
  setStick(fwd: number, lr: number): void;
  setClimb(dir: number): void;
}

export interface TouchControlsDeps {
  bus: Bus;
  avatar: TouchAvatarPort;
  stage: HTMLElement;
}

const TEMPLATE = `
  <div class="stick" id="stick" aria-hidden="true"><div class="knob"></div></div>
  <div class="climb" id="climb" hidden>
    <button class="climb-btn" data-climb="1" aria-label="Fly up">▲</button>
    <button class="climb-btn" data-climb="-1" aria-label="Fly down">▼</button>
  </div>`;

export function mount(deps: TouchControlsDeps): void {
  deps.stage.insertAdjacentHTML("beforeend", TEMPLATE);
  const stick = deps.stage.querySelector<HTMLElement>("#stick")!;
  const climb = deps.stage.querySelector<HTMLElement>("#climb")!;
  wireStick(stick, deps.avatar);
  wireClimb(climb, deps.avatar);
  const showClimb = () => (climb.hidden = !deps.avatar.flying);
  deps.bus.on("avatar:changed", showClimb);
  showClimb();
}

function wireStick(stick: HTMLElement, avatar: TouchAvatarPort): void {
  const knob = stick.querySelector<HTMLElement>(".knob")!;
  let finger: number | null = null;
  const follow = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    const reading = readStick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width / 2);
    knob.style.transform = `translate(${reading.knobX}px, ${reading.knobY}px)`;
    avatar.setStick(reading.fwd, reading.lr);
  };
  const release = (e: PointerEvent) => {
    if (e.pointerId !== finger) return;
    finger = null;
    knob.style.transform = "";
    stick.classList.remove("held");
    avatar.setStick(0, 0);
  };
  stick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    finger = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    stick.classList.add("held");
    follow(e);
  });
  stick.addEventListener("pointermove", (e) => {
    if (e.pointerId === finger) follow(e);
  });
  stick.addEventListener("pointerup", release);
  stick.addEventListener("pointercancel", release);
}

function wireClimb(climb: HTMLElement, avatar: TouchAvatarPort): void {
  for (const b of climb.querySelectorAll<HTMLElement>("[data-climb]")) {
    const stop = () => avatar.setClimb(0);
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      avatar.setClimb(+b.dataset.climb!);
    });
    b.addEventListener("pointerup", stop);
    b.addEventListener("pointercancel", stop);
  }
}
