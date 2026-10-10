import type { Bus } from "@/app/bus";

export interface GesturesDeps {
  bus: Bus;
  /** the bottom bar the button goes into; `.bottombar` by default (or #stage if there is none) */
  bar?: HTMLElement;
}
