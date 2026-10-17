import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // the start scene's scripts are .lua files, imported as their text (build.mjs does the same)
  plugins: [{ name: "lua-text", transform: (code, id) => (id.endsWith(".lua") ? `export default ${JSON.stringify(code)};` : null) }],
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
