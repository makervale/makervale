export interface Settings {
  snap: boolean;
  gridMetres: number;
  axes: "world" | "local" | "normal";
  stretchBothSides: boolean;
  selectGroupPartsSeparately: boolean;
  softRadiusMetres: number;
  mirrorX: boolean;
  segments: number;
  divisions: number;
  stayInCreate: boolean;
  smoothAngleDegrees: number;
  xray: boolean;
}

export const defaultSettings = (): Settings => ({
  snap: true,
  gridMetres: 1,
  axes: "world",
  stretchBothSides: true,
  selectGroupPartsSeparately: false,
  softRadiusMetres: 0,
  mirrorX: false,
  segments: 24,
  divisions: 1,
  stayInCreate: false,
  smoothAngleDegrees: 40,
  xray: false,
});
