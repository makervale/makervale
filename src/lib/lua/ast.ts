/** What a Lua program is made of once parsed. Every node that can fail at run time carries its line. */

export type BinOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "//"
  | "%"
  | "^"
  | ".."
  | "=="
  | "~="
  | "<"
  | ">"
  | "<="
  | ">="
  | "and"
  | "or";

export type UnOp = "-" | "not" | "#";

export interface FuncBody {
  params: string[];
  /** takes more arguments than it names, as "..." */
  vararg: boolean;
  body: Block;
  name: string;
  line: number;
}

export type TableItem =
  | { k: "pos"; v: Expr }
  | { k: "named"; key: string; v: Expr }
  | { k: "keyed"; key: Expr; v: Expr };

export type Expr =
  | { k: "nil" }
  | { k: "bool"; v: boolean }
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "name"; n: string; line: number }
  | { k: "index"; o: Expr; key: Expr; line: number }
  | { k: "call"; f: Expr; args: Expr[]; line: number }
  | { k: "method"; o: Expr; name: string; args: Expr[]; line: number }
  | { k: "fn"; f: FuncBody }
  | { k: "bin"; op: BinOp; a: Expr; b: Expr; line: number }
  | { k: "un"; op: UnOp; e: Expr; line: number }
  | { k: "table"; items: TableItem[]; line: number }
  | { k: "interp"; parts: (string | Expr)[]; line: number }
  | { k: "paren"; e: Expr }
  | { k: "vararg"; line: number };

export type CallExpr = Extract<Expr, { k: "call" } | { k: "method" }>;
/** what can stand left of "=" */
export type Target = Extract<Expr, { k: "name" } | { k: "index" }>;

export type Stmt =
  | { k: "local"; names: string[]; exprs: Expr[]; line: number }
  | { k: "localfn"; name: string; f: FuncBody; line: number }
  | { k: "assign"; targets: Target[]; exprs: Expr[]; line: number }
  | { k: "update"; target: Target; op: BinOp; e: Expr; line: number }
  | { k: "call"; e: CallExpr; line: number }
  | { k: "do"; body: Block; line: number }
  | { k: "while"; c: Expr; body: Block; line: number }
  | { k: "repeat"; body: Block; c: Expr; line: number }
  | { k: "if"; arms: { c: Expr; body: Block }[]; other: Block | null; line: number }
  | { k: "fornum"; v: string; from: Expr; to: Expr; step: Expr | null; body: Block; line: number }
  | { k: "forin"; names: string[]; exprs: Expr[]; body: Block; line: number }
  | { k: "return"; exprs: Expr[]; line: number }
  | { k: "break"; line: number }
  | { k: "continue"; line: number };

export type Block = Stmt[];
