/**
 * The Build window: handles and Create, what clicks select, pinned tools, the last-operation panel, a hint line,
 * and the Object / Material / Script / Scene tabs. Open means building. Also the Check mesh window.
 */
import { $ } from "@/ui/dom";
import type { Build } from "./context";
import { createBuild } from "./context";
import type { BuildWindowDeps } from "./deps";
import { wireEvents } from "./events";
import { wireGating } from "./gating";
import { wireLastOp } from "./last-op";
import { wireMaterialEdits } from "./material-edit";
import { renderMode, wireSoftRadius } from "./mode-block";
import { liveObjectTab } from "./object-tab";
import { wireObjectEdits } from "./object-edit";
import { openReport, REPORT_HTML } from "./report/report";
import { wireScriptEditor } from "./script-edit";
import { renderTab } from "./tabs";
import { renderQuick, renderStatus, renderTop } from "./toolbar";
import { BUILD_HTML } from "./view";

export type { BuildWindowDeps, ManipulatorPort, PinsPort, RoomPort, ScriptsPort } from "./deps";

function renderAll(b: Build): void {
  renderTop(b);
  renderMode(b);
  renderQuick(b);
  renderTab(b);
  renderStatus(b);
}

function listen(b: Build): void {
  const { bus, pins } = b.deps;
  bus.on("selection:changed", () => {
    renderMode(b);
    renderQuick(b);
    renderTab(b);
    renderStatus(b);
  });
  bus.on("mode:changed", () => renderAll(b));
  bus.on("world:changed", () => {
    renderQuick(b);
    renderTab(b);
    renderStatus(b);
  });
  bus.on("settings:changed", () => renderMode(b));
  bus.on("modifiers:changed", () => renderStatus(b));
  bus.on("world:dragging", () => liveObjectTab(b));
  bus.on("menu:command", ({ command }) => {
    if (command === "report") openReport(b.deps);
  });
  pins.onChange(() => renderQuick(b));
}

export function mount(deps: BuildWindowDeps): void {
  $("#stage").insertAdjacentHTML("beforeend", BUILD_HTML + REPORT_HTML);
  const b = createBuild(deps, $("#build-body"));
  b.renderTab = () => renderTab(b);
  wireEvents(b);
  wireLastOp(b);
  wireObjectEdits(b);
  wireMaterialEdits(b);
  wireSoftRadius(b);
  wireScriptEditor(b);
  listen(b);
  renderAll(b);
  wireGating(deps);
}
