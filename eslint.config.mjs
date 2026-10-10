// The rules that keep the code readable. They are deliberately strict about size: a file or function that grows past
// the limits is a sign that it does more than one thing.
import js from "@eslint/js";
import ts from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import prettier from "eslint-config-prettier";

const layers = ["ui", "lib", "world", "app", "avatar", "render", "net", "features"];
// what each layer may import (see ARCHITECTURE.md); ui and lib import nothing of ours
const allowed = {
  world: ["lib"],
  app: ["lib", "world"],
  render: ["lib", "world", "app"],
  avatar: ["lib", "world", "app", "render"],
  net: ["lib", "world", "app", "avatar", "render"],
  features: ["lib", "world", "app", "avatar", "render", "net", "ui"],
};

function layerRules(layer) {
  const forbidden = layers.filter((l) => l !== layer && !(allowed[layer] || []).includes(l));
  return {
    files: [`src/${layer}/**/*.ts`],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: forbidden.map((l) => ({ group: [`**/${l}/**`, `@/${l}/**`], message: `${layer} must not import from ${l}` })) },
      ],
    },
  };
}

export default ts.config(
  { ignores: ["dist/**", "old/**", "old-test/**", "node_modules/**", "tools/**", "build.mjs", "eslint.config.mjs"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  {
    files: ["src/**/*.ts"],
    plugins: { "import-x": importX },
    rules: {
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true }],
      "max-depth": ["error", 3],
      "max-params": ["error", 5],
      complexity: ["error", 12],
      "no-nested-ternary": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "import-x/no-cycle": "error",
      "no-restricted-syntax": ["error", { selector: "TSEnumDeclaration", message: "Use a union of string literals." }],
    },
  },
  { files: ["src/net/sanitize.ts", "src/**/*.test.ts"], rules: { "@typescript-eslint/no-explicit-any": "off", "max-lines-per-function": "off", "max-lines": "off" } },
  // features talk through the bus, never to each other; and change history only through commands
  { files: ["src/features/*/**/*.ts"], rules: {
      "no-restricted-syntax": ["error",
        { selector: "TSEnumDeclaration", message: "Use a union of string literals." },
        { selector: "MemberExpression[object.property.name='history'][property.name=/^(begin|end|cancel|undo|redo)$/]", message: "Use commands (act, startHeld, finishHeld, cancelHeld, undo, redo)." }], "no-restricted-imports": ["error", { patterns: [{ group: ["../*/**", "../../features/**"], message: "Features talk through the bus, not to each other" }] }] } },
  ...layers.filter((l) => l !== "features").map(layerRules),
);
