/**
 * The scene as it is saved: every scripted object as it was before its script changed it (the lift down, the door
 * shut, the lantern dark), and without the script's variables. A reload then starts every script fresh, and the
 * object and its script agree again. Live rooms still send the scene as it is right now.
 */
import type { Obj, World } from "./model";

export function resting(o: Obj): Obj {
  const st = o.scriptState;
  if (!st) return o;
  const out: Obj = { ...o, pos: [...st.home.pos], quat: [...st.home.quat], size: [...st.home.size] };
  delete out.scriptState;
  const look = st.home.look;
  if (!look) return out;
  out.materials = structuredClone(look.materials);
  out.hidden = look.hidden;
  if (look.spin) out.spin = [...look.spin];
  else delete out.spin;
  return out;
}

export const restingWorld = (w: World): World => ({ seq: w.seq, objects: w.objects.map(resting) });
