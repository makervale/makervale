/** Physics for anything you build: make an object a ball that rolls and bounces, or a trampoline. */
import type { ParamDef } from "@/app/tools";
import type { CatalogTool, ToolApp } from "./app";
import { objectTool } from "./objects";

const BOUNCE: ParamDef = {
  key: "bounce",
  label: "Bounce",
  min: 0,
  max: 1,
  step: 0.05,
  def: 0.65,
  decimals: 2,
  help: "0 lands dead, 1 bounces back as high as it fell",
};

const LAUNCH: ParamDef = {
  key: "speed",
  label: "Launch",
  min: 2,
  max: 20,
  step: 0.5,
  def: 10,
  decimals: 1,
  unit: "m/s",
  help: "how fast it throws you up: 10 is about five metres",
};

export function physicsTools(app: ToolApp): CatalogTool[] {
  return [
    objectTool(app, {
      id: "ball",
      name: "Make it a ball",
      need: "objects",
      synonyms: ["ball", "physics", "roll", "bounce", "kick", "football", "dynamic", "rigid body", "gravity"],
      summary:
        "Turns the selected objects into balls: they fall, roll and bounce, and people kick them by walking " +
        "into them. In a room everyone sees the same ball. Run it again on a ball to make it still again.",
      steps: ["Select an object (round ones roll best).", "Make it a ball; change Bounce in the panel."],
      run: (c, p) => {
        const off = c.objs.every((o) => o.body);
        for (const o of c.objs) {
          if (off) delete o.body;
          else o.body = { shape: "ball", bounce: p.bounce };
        }
        return off ? "Still again: " + c.objs.length : "Now a ball: walk into it to kick it";
      },
      extra: { params: [BOUNCE] },
    }),
    objectTool(app, {
      id: "trampoline",
      name: "Make it a trampoline",
      need: "objects",
      synonyms: ["trampoline", "spring", "jump pad", "bounce pad", "launch", "boing"],
      summary: "Whoever stands on the selected objects is thrown up into the air. Run it again to make them ordinary.",
      steps: ["Select an object with a flat top.", "Make it a trampoline; change Launch in the panel."],
      run: (c, p) => {
        const off = c.objs.every((o) => o.spring);
        for (const o of c.objs) {
          if (off) delete o.spring;
          else o.spring = p.speed;
        }
        return off ? "Ordinary ground again: " + c.objs.length : "Now a trampoline: step on it";
      },
      extra: { params: [LAUNCH] },
    }),
  ];
}
