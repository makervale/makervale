/** The pie when not building: what you can do in the world, plus a way into building (on a computer). */
import type { Obj } from "@/world/model";
import { isPhone } from "@/ui/device";
import { showWindow } from "@/ui/window";
import type { Pie } from "./build-items";
import { placeItems, sitItems, touchItem } from "./common-items";
import type { PieDeps, PieItem } from "./deps";

export function worldPie(d: PieDeps, x: number, y: number): Pie {
  const hit = d.renderer.picker.pickWorld(x, y);
  const o = hit?.id ? d.store.byId(hit.id) : undefined;
  const items: PieItem[] = [];
  const touch = o && touchItem(d, o);
  if (touch) items.push(touch);
  const [sit, stand] = sitItems(d, hit);
  if (stand) items.push(stand);
  if (sit) items.push(sit);
  // building needs a computer; a phone gets only what works there
  const building = !isPhone();
  if (building) items.push(...editItems(d, o));
  items.push(...placeItems(d, hit));
  if (building) items.push({ label: "Build", run: () => openBuild(d, o) });
  return { title: o ? o.name : "World", items };
}

function openBuild(d: PieDeps, o: Obj | undefined): void {
  showWindow("build", true);
  if (o) d.commands.selectObject(o, false);
}

function editItems(d: PieDeps, o: Obj | undefined): PieItem[] {
  const items: PieItem[] = [];
  if (o) items.push({ label: "Edit", run: () => openBuild(d, o) });
  if (o?.script) {
    const id = o.id;
    items.push({
      label: "Edit script",
      run: () => {
        showWindow("build", true);
        d.bus.emit("script:open", { id });
      },
    });
  }
  return items;
}
