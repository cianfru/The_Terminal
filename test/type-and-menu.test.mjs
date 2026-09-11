import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";

const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("one self-hosted type system, no third-party font request", () => {
  // The landing embedded its own Geist/Geist Mono while the app downloaded DIFFERENT files from
  // Google, so the page people land on from X rendered in one typeface and every page after it in
  // another.
  const html = read("index.html"), css = read("src/index.css");
  assert.ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html), "no Google Fonts on the app");
  assert.ok(!/fonts\.googleapis\.com/.test(read("public/landing-next.html")), "nor on the landing");
  for (const fam of ["Geist", "Geist Mono", "GeistMono"]) {
    assert.ok(css.includes(`font-family:'${fam}'`), `${fam} is declared locally`);
  }
  assert.match(css, /font-weight:100 900/, "the variable range covers every weight in use");
});

test("the landing and the app load the SAME font files", () => {
  const landing = read("public/landing-next.html");
  for (const f of ["/fonts/Geist.woff2", "/fonts/GeistMono.woff2"]) {
    assert.ok(landing.includes(f), `landing uses ${f}`);
    assert.ok(read("src/index.css").includes(f), `app uses ${f}`);
    assert.ok(existsSync(new URL("../public" + f, import.meta.url)), `${f} exists`);
  }
  assert.ok(!/src:url\(data:font\//.test(landing.split("</style>")[0]), "no embedded copy left to drift");
});

test("the base tokens agree with the sub-page tokens", () => {
  // index.css used system mono and Space Grotesk while terminal.css used Geist Mono and Geist, so
  // text changed typeface depending on which zone it was in.
  const base = read("src/index.css"), zone = read("src/terminal.css");
  const first = (s, k) => s.match(new RegExp(`--${k}:\\s*'?([A-Za-z ]+)'?`))[1].trim();
  assert.equal(first(base, "sans"), first(zone, "sans"));
  assert.equal(first(base, "mono"), first(zone, "mono"));
});

test("no control is left without a font (the Arial fallback)", () => {
  const css = read("src/terminal.css");
  assert.match(css, /\.tzone \.tsbcellarrow, \.tzone \.tsbstar/, "launcher glyphs have a family");
  assert.match(read("src/ChartsGallery.jsx"), /fontFamily: SANS, fontSize: 27/, "cover glyph too");
});

test("3D overlay labels use the site typeface, not a second one", () => {
  for (const f of ["src/SpxCity.jsx", "src/Urpd3D.jsx", "src/Skyline3D.jsx", "src/WhalesWatching.jsx", "src/UrpdTerrain3D.jsx"]) {
    assert.ok(!/Space Grotesk/.test(read(f)), `${f} no longer asks for a different face`);
  }
});

test("the launcher is six equal tiles, not four squares and a strip", () => {
  const nav = read("src/TerminalNav.jsx"), css = read("src/terminal.css");
  const ids = [...nav.matchAll(/\{ id: "(rainbow|charts|city|aeon|deepfield|manual)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ["rainbow", "charts", "city", "aeon", "deepfield", "manual"], "six destinations");
  assert.ok(!nav.includes('className="tsbdf"'), "the odd full-width strip is gone");
  assert.match(css, /\.tzone \.tsbgrid-quad\{ display:grid; grid-template-columns:1fr 1fr/, "2 columns");
  assert.match(css, /\.tzone \.tsbcell\{[^}]*border-radius:0;/, "square corners, like the rest of the site");
  assert.match(css, /\.tzone \.tsbcell::after\{[^}]*background:var\(--tc\)/, "a hard bar of the section colour");
  for (const id of ["deepfield", "manual"]) {
    assert.ok(nav.includes(`  ${id}: <svg`), `${id} has its own icon and motif`);
  }
});

test("both new tiles go somewhere that already existed", () => {
  // Nothing invented to fill the grid: Deep Field and the Manual were both already destinations.
  const nav = read("src/TerminalNav.jsx"), app = read("src/App.jsx");
  assert.match(nav, /openDocs && openDocs\("index"\)/, "Manual opens the docs route");
  assert.match(app, /openDocs=\{openDocs\}/, "which App already had");
  assert.match(nav, /go\(onDeepField\)/, "Deep Field keeps its own handler");
});

test("the font files are small enough to preload", () => {
  for (const f of ["Geist.woff2", "GeistMono.woff2"]) {
    const kb = statSync(new URL("../public/fonts/" + f, import.meta.url)).size / 1024;
    assert.ok(kb < 60, `${f} is ${kb.toFixed(0)}KB`);
  }
  assert.match(read("index.html"), /rel="preload" as="font"[^>]*Geist\.woff2/, "and they are preloaded");
});

test("the launcher title is balanced against the buttons, not the leftover space", () => {
  // The left side carries back + all-sections and the right only close, so the title (a flex child
  // by design, so it can never overlap the left buttons) sat 27px right of the bar's true centre.
  const nav = read("src/TerminalNav.jsx"), css = read("src/terminal.css");
  assert.match(nav, /className="tsbbtn tsbspacer" aria-hidden="true"/, "a spacer balances the right side");
  assert.match(css, /\.tzone \.tsbspacer\{[^}]*pointer-events:none/, "and it is inert");
});

test("the launcher is square-cornered throughout, like the rest of the site", () => {
  const css = read("src/terminal.css");
  for (const sel of ["tsbbtn", "tsbsearchin", "tsbchip", "tsbdocki", "tsbdockout"]) {
    const at = css.indexOf(`.tzone .${sel}{`);
    assert.ok(at > -1, `${sel} has a rule`);
    const block = css.slice(at, css.indexOf("}", at));
    assert.ok(block.includes("border-radius:0"), `${sel} is square — found: ${(block.match(/border-radius:[^;]*/) || ["none"])[0]}`);
  }
  // and the tiles themselves
  const tile = css.indexOf(".tzone .tsbcell{");
  assert.ok(css.slice(tile, css.indexOf("}", tile)).includes("border-radius:0"), "tiles are square");
});
