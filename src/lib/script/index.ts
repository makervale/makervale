/** Piaskownica Script: a tiny language for making objects do things,
 *  small and safe to run on anyone's computer. Every handler runs as a generator that the runtime
 *  steps a bounded number of times per frame.
 *
 *    var open = false
 *    on touch {
 *      open = not open
 *      if open { turn 0, 0, 90 in 0.6 } else { turn 0, 0, -90 in 0.6 }
 *      say who + " opened the door"
 *    }
 *
 *  Events: on start · on touch · on timer SECONDS · on near METRES · on hear ["word"] · on bump ·
 *          on blocked (a move didn't fit: the place is too dense)
 *  Actions: move X, Y, Z [in S] · turn X, Y, Z [in S] · grow K [in S] · home [in S] · pivot X, Y, Z ·
 *           spin X, Y, Z · color "#rrggbb" [, MATERIAL] · glow V [, MATERIAL] · opacity V [, MATERIAL] ·
 *           show · hide · say TEXT · timer S · wait S · stop      (MATERIAL: 1 for the first material, 2…)
 *  Values: numbers, "text", true/false; + - * / %, == != < > <= >=, and or not; if/else, repeat N, while.
 *  Built in: who, heard, time, me, random(a, b), round(x), floor(x), abs(x), min(a, b), max(a, b),
 *            sin(deg), cos(deg), text(x), len(x), contains(a, b). */
export { ACTIONS, EVENTS, MAX_SOURCE, ScriptError } from "./ast";
export type { ActionSpec, EventName, Expr, Handler, Program, Stmt, Val } from "./ast";
export { parse } from "./parser";
export { evalArg, evalText, initGlobals, startHandler } from "./interpreter";
export { STEP_BUDGET } from "./runtime";
export type { Ctx, Yield } from "./runtime";
export { show } from "./values";
export { TEMPLATES } from "./templates";
export type { Template } from "./templates";
