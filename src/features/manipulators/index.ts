/**
 * Manipulators: the move / rotate / stretch handles on the selection and the drags that use them. main.ts mounts
 * it and hands the returned object to viewport-input (which starts and drives drags) and live-tool (badge, pivot).
 * Call `update()` every frame.
 */
import type { ManipDeps } from "./env";
import { Manipulators } from "./manipulators";

export type { ManipDeps } from "./env";
export type { Drag } from "./drag-types";
export type { GrabStart } from "./grab";
export { Manipulators } from "./manipulators";

export function mount(deps: ManipDeps): Manipulators {
  return new Manipulators(deps);
}
