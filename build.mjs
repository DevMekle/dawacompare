import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const out = await build({
  entryPoints: ["src/main.tsx"], bundle: true, write: false, format: "iife", target: "es2019",
  minify: true, jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment",
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync("src/styles.css", "utf8");
const html = `<title>DawaCompare</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Compare medicine prices for the same salt, strength and release type. Prototype with demonstration data.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Figtree:wght@400;500;600;700;800&family=Mukta:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<noscript><p style="padding:16px">DawaCompare needs JavaScript to run.</p></noscript>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
mkdirSync("dist", { recursive: true });
writeFileSync("dist/dawacompare.html", html);
// Standalone version (full document) for opening the file directly in a browser.
writeFileSync("dist/index.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${html}</body></html>`);
console.log("built", (html.length / 1024).toFixed(1) + " KB");
