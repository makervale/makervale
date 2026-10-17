/** Errors a script can run into, and the limits every part of the language agrees on. */

export const MAX_SOURCE = 20_000;
/** the longest text a script can make */
export const MAX_STRING = 65_536;
/** how deep functions may call each other */
export const MAX_CALL_DEPTH = 200;

/**
 * An error in a script, with the line it happened on. `value` is what error() was given (a script can catch it with
 * pcall); `fatal` errors (a script that never waits, one that is too big) can't be caught.
 */
export class LuaError extends Error {
  constructor(
    readonly msg: string,
    readonly line: number,
    readonly value: unknown = msg,
    readonly fatal = false,
  ) {
    super(line > 0 ? `line ${line}: ${msg}` : msg);
  }
}

export const fail = (msg: string, line: number): never => {
  throw new LuaError(msg, line);
};
