/**
 * Live tools: tools that stay active in the viewport while the mouse adjusts them. Listens to "tool:use" (live tools
 * start live, the others run through the ToolRunner). viewport-input forwards pointer and key events to the
 * returned LiveTool.
 */
import type { LiveDeps } from "./env";
import { LiveTool } from "./live-tool";

export type { LiveDeps, ManipPort } from "./env";
export { LiveTool } from "./live-tool";

export function mount(deps: LiveDeps): LiveTool {
  return new LiveTool(deps);
}
