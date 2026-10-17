/** a .lua file imported as its text (build.mjs and vitest.config load it so) */
declare module "*.lua" {
  const source: string;
  export default source;
}
