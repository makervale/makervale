// Bundle the TypeScript app, three.js included, into one HTML page: the page itself never contacts another server.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';

// a visible build stamp, so it's obvious which version is running (a downloaded copy doesn't update itself)
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const res = await build({
  define: { __BUILD__: JSON.stringify(stamp) },
  entryPoints: ['src/main.ts'], bundle: true, format: 'esm', target: 'es2020', write: false, minify: true,
  legalComments: 'none', alias: { '@': './src' },
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
import { readdirSync } from 'node:fs';
// base.css first (variables, layout), mobile.css last (it overrides the desktop layout on small touch screens)
const cssOrder = (f) => (f === 'base.css' ? 0 : f === 'mobile.css' ? 2 : 1);
const css = readdirSync('src/styles').filter(f => f.endsWith('.css')).sort((a, b) => cssOrder(a) - cssOrder(b) || a.localeCompare(b)).map(f => readFileSync('src/styles/' + f, 'utf8')).join('\n');
const body = readFileSync('src/index.html', 'utf8');
const page = `<title>Makervale</title>
<style>
${css}</style>
${body}
<script type="module">
${js}
</script>
`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/piaskownica.html', page);
// the same page as a complete document: for the local tests, and (as index.html) for hosting it anywhere
const doc = '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>' + page + '</body></html>';
writeFileSync('dist/test.html', doc);
writeFileSync('dist/index.html', doc);
// avatar models and thumbnails published next to the page
cpSync('assets/avatars', 'dist/avatars', { recursive: true, filter: f => !f.endsWith('.thumb') });
console.log('dist/piaskownica.html', (page.length / 1024).toFixed(0) + ' kB', 'build', stamp);
