/** Where the preset views look from (unit-ish directions from the objects to the camera, Z up). */
export type PresetView = "front" | "side" | "rear" | "top";

export const PRESET_DIRECTIONS: Record<PresetView, [number, number, number]> = {
  front: [0, -1, 0.3],
  side: [1, 0, 0.3],
  rear: [0, 1, 0.3],
  // not exactly vertical: the camera's up vector must not be parallel to the view
  top: [0.001, -0.001, 1],
};

export const HOME_DIRECTION: [number, number, number] = [1, -1.25, 0.8];

/** how far away to stand, in units of the objects' radius */
export const FRAME_K = 2.6;
export const PRESET_K = 2.4;
