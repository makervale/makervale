/** the build stamp, set by build.mjs; "dev" when running from source (tests, a dev server) */
declare const __BUILD__: string;

export const BUILD: string = typeof __BUILD__ === "string" ? __BUILD__ : "dev";
