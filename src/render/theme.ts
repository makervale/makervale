/** The colours the viewport shares with the page's stylesheet (axes, selection, pre-selection). */
export interface Theme {
  x: string;
  y: string;
  z: string;
  accent: string;
  /** outline of the selected object (or the last selected one in a group) */
  root: string;
  /** outline of the other objects of a selected group */
  child: string;
  fg: string;
  /** what a click would pick */
  pre: string;
}

const FALLBACK: Theme = {
  x: "#e03c2f",
  y: "#3fbf3f",
  z: "#3f7fe0",
  accent: "#4dd1ff",
  root: "#ffff33",
  child: "#216bc4",
  fg: "#ffffff",
  pre: "#ffa94d",
};

const VARS: Record<keyof Theme, string> = {
  x: "--x",
  y: "--y",
  z: "--z",
  accent: "--emph",
  root: "--sil-root",
  child: "--sil-child",
  fg: "--white",
  pre: "--pre",
};

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** the theme as the stylesheet defines it, with built-in colours where a variable is missing */
export function readTheme(): Theme {
  const theme = { ...FALLBACK };
  for (const key of Object.keys(VARS) as (keyof Theme)[]) {
    const value = cssVar(VARS[key]);
    if (value) theme[key] = value;
  }
  return theme;
}
