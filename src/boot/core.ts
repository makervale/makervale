/** The spine every part shares: state, events, the one writer, and the tools. */
import { Bus } from "@/app/bus";
import { Commands } from "@/app/commands";
import { Store } from "@/app/store";
import { ToolRunner } from "@/app/tool-runner";
import { ToolRegistry } from "@/app/tools";
import { registerTools } from "@/features/tools";
import { toast } from "@/ui/toast";

export interface Core {
  store: Store;
  bus: Bus;
  commands: Commands;
  runner: ToolRunner;
}

export function createCore(): Core {
  const store = new Store();
  const bus = new Bus();
  const commands = new Commands(store, bus, (message) => toast(message));
  const registry = new ToolRegistry();
  registerTools(registry, { store, bus, commands });
  return { store, bus, commands, runner: new ToolRunner(store, commands, bus, registry) };
}
