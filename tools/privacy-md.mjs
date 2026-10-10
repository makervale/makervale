// PRIVACY.md from the text the app shows (src/app/privacy.ts), so the page the app is published on says the same.
import { build } from "esbuild";
import { writeFileSync } from "node:fs";

const out = await build({ entryPoints: ["src/app/privacy.ts"], bundle: true, format: "esm", write: false });
const mod = await import("data:text/javascript," + encodeURIComponent(out.outputFiles[0].text));
const md = mod.PRIVACY_HTML.replace(/\s*\n\s*/g, " ")
  .replace(/<p class="terms-date">Version ([^<]*)<\/p>/, "Version $1. The same text is shown in the app before first use and under Help › Privacy.\n\n")
  .replace(/<h4>(.*?)<\/h4>/g, "\n## $1\n\n")
  .replace(/<li>(.*?)<\/li>/g, "- $1\n")
  .replace(/<\/?ul>/g, "\n")
  .replace(/<p>(.*?)<\/p>/g, "$1\n\n")
  .replace(/<\/?b>/g, "**")
  .replace(/<\/?code>/g, "`")
  .replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/g, "[$2]($1)")
  .replace(/\n\s*\n(\s*\n)+/g, "\n\n")
  .replace(/^ +| +$/gm, "")
  .trim();
writeFileSync("PRIVACY.md", "# Privacy and terms\n\n" + md + "\n");
console.log("PRIVACY.md", md.length, "chars");
