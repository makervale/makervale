/** One-shot gestures that play over whatever the legs are doing; each has a standing and (maybe) a seated clip. */
export interface Gesture {
  label: string;
  stand: string;
  /** null: no seated clip, so seated bodies play the standing one on the upper body only */
  sit: string | null;
}

export const GESTURES: Record<string, Gesture> = {
  wave: { label: "Raise hand", stand: "raiseHand", sit: "sitRaiseHand" },
  clap: { label: "Clap", stand: "clap", sit: "sitClap" },
  yes: { label: "Nod", stand: "nod", sit: "sitNod" },
  no: { label: "Shake head", stand: "shake", sit: null },
  point: { label: "Point", stand: "point", sit: null },
};

/** which clip a gesture plays, and whether only the upper body takes part */
export function gestureClip(id: string, sitting: boolean): { clip: string; upperOnly: boolean } | null {
  const g = GESTURES[id];
  if (!g) return null;
  if (sitting && g.sit) return { clip: g.sit, upperOnly: false };
  return { clip: g.stand, upperOnly: sitting };
}
