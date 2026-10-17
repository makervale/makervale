/** Running statements. A block hands back how it ended: ran off its end, break, continue, or return. */
import type { Block, Stmt, Target } from "./ast";
import type { Signal } from "./call";
import { bindRunner, inScope } from "./call";
import { evalCall, evalExpr, evalList, lookup, nameOf } from "./eval";
import { index, setIndex } from "./index-ops";
import { forIn, forNum, repeatLoop, whileLoop } from "./loops";
import type { Ctx, Gen, Value } from "./table";
import type { Scope } from "./table";
import { Closure } from "./table";
import { binary, truthy } from "./values";

type Of<K extends Stmt["k"]> = Extract<Stmt, { k: K }>;
type Runner = (st: never, s: Scope, c: Ctx) => Gen<Signal>;

export function* execBlock(body: Block, s: Scope, c: Ctx): Gen<Signal> {
  for (const st of body) {
    c.steps++;
    const quick = QUICK[st.k];
    const sig = quick ? quick(st as never, s) : yield* EXEC[st.k]!(st as never, s, c);
    if (sig) return sig;
  }
  return undefined;
}

/** statements that never call anything */
const QUICK: Partial<Record<Stmt["k"], (st: never, s: Scope) => Signal>> = {
  localfn(st: Of<"localfn">, s) {
    // declared before it is made, so it can call itself
    s.vars.set(st.name, undefined);
    s.vars.set(st.name, new Closure(st.f, s));
    return undefined;
  },
  break: () => "break",
  continue: () => "continue",
};

bindRunner(execBlock);

function* assign(t: Target, v: Value, s: Scope, c: Ctx): Gen<void> {
  if (t.k === "name") {
    const owner = s.find(t.n);
    if (owner) owner.vars.set(t.n, v);
    else c.globals.set(t.n, v, t.line);
    return;
  }
  const o = yield* evalExpr(t.o, s, c);
  yield* setIndex(o, yield* evalExpr(t.key, s, c), v, c, { line: t.line, what: nameOf(t.o) });
}

function* update(st: Of<"update">, s: Scope, c: Ctx): Gen<Signal> {
  const t = st.target;
  if (t.k === "name") {
    const v = binary(st.op, lookup(t.n, s, c), yield* evalExpr(st.e, s, c), st.line);
    yield* assign(t, v, s, c);
    return undefined;
  }
  const o = yield* evalExpr(t.o, s, c);
  const key = yield* evalExpr(t.key, s, c);
  const old = yield* index(o, key, c, t.line, nameOf(t.o));
  const v = binary(st.op, old, yield* evalExpr(st.e, s, c), st.line);
  yield* setIndex(o, key, v, c, { line: t.line, what: nameOf(t.o) });
  return undefined;
}

const EXEC: Partial<Record<Stmt["k"], Runner>> = {
  *local(st: Of<"local">, s, c) {
    const vals = yield* evalList(st.exprs, s, c);
    st.names.forEach((n, i) => s.vars.set(n, vals[i]));
    return undefined;
  },
  *assign(st: Of<"assign">, s, c) {
    const vals = yield* evalList(st.exprs, s, c);
    for (let i = 0; i < st.targets.length; i++) yield* assign(st.targets[i], vals[i], s, c);
    return undefined;
  },
  update,
  *call(st: Of<"call">, s, c) {
    yield* evalCall(st.e, s, c);
    return undefined;
  },
  *do(st: Of<"do">, s, c) {
    return yield* inScope(st.body, s, c);
  },
  *if(st: Of<"if">, s, c) {
    for (const arm of st.arms) if (truthy(yield* evalExpr(arm.c, s, c))) return yield* inScope(arm.body, s, c);
    return st.other ? yield* inScope(st.other, s, c) : undefined;
  },
  while: whileLoop,
  repeat: repeatLoop,
  fornum: forNum,
  forin: forIn,
  *return(st: Of<"return">, s, c) {
    return { ret: yield* evalList(st.exprs, s, c) };
  },
};
