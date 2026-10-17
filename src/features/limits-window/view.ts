/** What the Limits window shows: how close this scene is to the limits every scene has, in plain words. */

export interface Levels {
  /** the whole scene against the most a scene may hold, % */
  scene: number;
  /** the most crowded spot against how much may stand close together, % */
  tightest: number;
  /** the scripts' share of each second, %; null where they don't run (in a room, on another computer) */
  scripts: number | null;
}

const level = (p: number): string => {
  if (p >= 90) return " full";
  return p >= 67 ? " busy" : "";
};

function meter(label: string, pct: number, about: string): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="lim-meter${level(p)}"><span class="lim-label">${label}</span>
    <span class="lim-bar"><i style="width:${p}%"></i></span><span class="lim-pct">${p}%</span>
    <span class="lim-about">${about}</span></div>`;
}

export function limitsHTML(l: Levels, sandMap: boolean): string {
  return `<p class="note">Every scene and every room has the same limits, so it runs well for everyone who comes in.</p>
    <h4>Space</h4>
    ${meter("Whole scene", l.scene, "Everything here, against the most a scene may hold.")}
    ${meter("Tightest spot", l.tightest, "The most crowded place, against how much may stand close together.")}
    <p class="note">When one is full, new things won't fit there until something is removed or simplified.</p>
    <label class="lim-check"><input type="checkbox" id="lim-sand" ${sandMap ? "checked" : ""}>
      Show where space is tight (sand map)</label>
    <h4>Scripts</h4>
    ${
      l.scripts === null
        ? `<p class="note">In this room the scripts run on another person's computer, so they are measured there.</p>`
        : meter("Last second", l.scripts, "How much of each second the scripts here use.")
    }
    <p class="note">Near the top, scripts take turns and run slower; nothing breaks. In a room you own, Multiplayer
      shows whose scripts take the most.</p>`;
}
