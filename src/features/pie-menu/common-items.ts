/** Pie items both pies share: touch a scripted object, sit or stand, go to a point or look at it. */
import type { WorldHit } from "@/render/picking";
import type { Obj } from "@/world/model";
import type { PieDeps, PieItem } from "./deps";

/** surfaces facing up at least this much (normal's z) can be sat on */
const SIT_NORMAL_Z = 0.35;

export function touchItem(d: PieDeps, o: Obj): PieItem | null {
  if (!d.scripts.touchable(o)) return null;
  return { label: "Touch", run: () => d.scripts.touch(o.id, d.avatar.name) };
}

/** [sit here, stand up], each when it applies */
export function sitItems(d: PieDeps, hit: WorldHit | null): [PieItem | null, PieItem | null] {
  const seat = hit && hit.id && hit.normal.z > SIT_NORMAL_Z ? hit.point.clone() : null;
  const sit = seat ? { label: "Sit here", run: () => d.avatar.sitAt(seat) } : null;
  const stand = d.avatar.sitting ? { label: "Stand up", run: () => d.avatar.standUp() } : null;
  return [sit, stand];
}

export function placeItems(d: PieDeps, hit: WorldHit | null): PieItem[] {
  return [
    { label: "Teleport here", run: () => hit && d.avatar.teleportTo(hit.point), disabled: !hit },
    { label: "Focus camera", run: () => hit && d.renderer.camera.setFocus(hit.point, hit.id), disabled: !hit },
  ];
}
