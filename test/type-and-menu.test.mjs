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

test("the launcher is equal tiles, not four squares and a strip", () => {
  // FIVE now, not six: the Manual was pulled out. It is the SPX City manual, so at top level it
  // read as random next to Rainbow and Charts, and it competed with what people come for.
  const nav = read("src/TerminalNav.jsx"), css = read("src/terminal.css");
  const ids = [...nav.matchAll(/\{ id: "(rainbow|charts|city|aeon|deepfield|manual)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ["rainbow", "charts", "city", "aeon", "deepfield"], "five destinations");
  assert.ok(!ids.includes("manual"), "the Manual is not a top-level tile");
  assert.ok(!nav.includes('className="tsbdf"'), "the odd full-width strip is gone");
  assert.match(css, /\.tzone \.tsbgrid-quad\{ display:grid; grid-template-columns:1fr 1fr/, "2 columns");
  assert.match(css, /\.tzone \.tsbcell\{[^}]*border-radius:0;/, "square corners, like the rest of the site");
  assert.match(css, /\.tzone \.tsbcell::after\{[^}]*background:var\(--tc\)/, "a hard bar of the section colour");
  assert.ok(nav.includes("  deepfield: <svg"), "deepfield has its own motif");
  assert.ok(!nav.includes("  manual: <svg"), "and the Manual's motif went with its tile");
});

test("the launcher invents no destination, and drops the docs prop it no longer needs", () => {
  const nav = read("src/TerminalNav.jsx"), app = read("src/App.jsx");
  assert.match(nav, /go\(onDeepField\)/, "Deep Field keeps its own handler");
  // Removing the Manual tile left openDocs unused in the nav; it must not linger as a dead prop.
  assert.ok(!nav.includes("openDocs"), "the nav no longer takes openDocs");
  assert.ok(!app.includes("openDocs={openDocs}"), "and App stops threading it in");
  assert.match(app, /onNavigate=\{openDocs\}/, "the docs route itself still exists");
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

test("BOTH mobile launchers carry the same tiles — the landing has its own", () => {
  // The landing ships a second, independent springboard in vanilla JS, so every launcher change
  // has to be made twice or the two drift apart.
  const landing = read("public/landing-next.html");
  assert.ok(landing.includes("secQuad('/deepfield','deepfield'"), "Deep Field is a peer tile");
  assert.ok(!landing.includes("secQuad('/?view=docs','manual'"), "the Manual tile is gone here too");
  assert.ok(!/foot=`<button class="sbdf"/.test(landing), "the full-width strip is gone");
  assert.ok(landing.includes("grid-auto-rows:1fr"), "all three rows are equal");
  assert.ok(!/grid-template-rows:1fr 1fr/.test(landing), "no hardcoded two-row grid to squash the third");
});

test("both launchers speak the website menu's type: mono, uppercase, letterspaced", () => {
  // The reference is .tzone .mtop > .mhead — the desktop menu bar.
  const css = read("src/terminal.css");
  const menu = css.match(/\.tzone \.mtop > \.mhead\{[^}]*\}/)[0];
  assert.match(menu, /font-family:var\(--mono\)/);
  assert.match(menu, /text-transform:uppercase/);
  for (const sel of ["tsbcellnm", "tsbrownm"]) {
    const at = css.indexOf(`.tzone .tsbcell .${sel}{`) > -1 ? css.indexOf(`.tzone .tsbcell .${sel}{`) : css.indexOf(`.tzone .${sel}{`);
    const block = css.slice(at, css.indexOf("}", at));
    assert.match(block, /font-family:var\(--mono\)/, `${sel} uses the menu face`);
    assert.match(block, /text-transform:uppercase/, `${sel} is uppercase`);
  }
  const landing = read("public/landing-next.html");
  const tile = landing.match(/\.sbcellnm\{[^}]*\}/)[0];
  assert.match(tile, /font-family:var\(--label\)/, "landing tiles use the menu face too");
  assert.match(tile, /text-transform:uppercase/);
});

test("nothing in either mobile menu is still rounded", () => {
  const css = read("src/terminal.css"), landing = read("public/landing-next.html");
  const square = (src, sel, label) => {
    const at = src.indexOf(sel);
    assert.ok(at > -1, `${label} exists`);
    const block = src.slice(at, src.indexOf("}", at));
    const m = block.match(/border-radius:([^;]*)/);
    if (m) assert.equal(m[1].trim(), "0", `${label} is square (found ${m[1]})`);
  };
  for (const sel of [".tzone .tmobtog{", ".tzone .tmobclose{", ".tzone .tsbtile{", ".tzone .tsbrowedge{"]) square(css, sel, sel);
  for (const sel of [".mobtog{", ".mmclose{", ".sbbtn{", ".sbtile{", ".sbdocki{", ".sbcell{"]) square(landing, sel, "landing " + sel);
});

test("launcher tiles carry no corner icon, and say what a section IS, not how many parts it has", () => {
  // The small corner icon repeated the background motif that already carries the section colour,
  // and at 390px it collided with the name whenever the subtitle wrapped to two lines. The
  // subtitles were inventories ("8 groups · 57 charts") that wrapped for the same reason.
  const css = read("src/terminal.css"), nav = read("src/TerminalNav.jsx"), landing = read("public/landing-next.html");
  for (const [src, sel, label] of [[css, "tsbcellico", "app CSS"], [landing, "sbcellico", "landing CSS"],
    [nav, "tsbcellico", "app markup"], [nav, "SB_ICON", "app icon map"]])
    assert.ok(!src.includes(sel), `${label} no longer references ${sel}`);
  // Check the expressions that BUILD the subtitle, not the file text — a prose comment mentioning
  // the old format is not a regression, and matching on it made this assertion fire on itself.
  assert.ok(!/sec\.groups\.length \+ ?['"] groups/.test(nav) && !/groups\.length\} groups/.test(nav),
    "app builds a descriptor, not a group count");
  assert.ok(!/groups\.length ?\+ ?' groups/.test(landing), "landing builds a descriptor, not a group count");
  assert.ok(landing.includes("SEC_DESC"), "landing has per-section descriptors");
  assert.match(nav, /desc: n =>/, "app has per-section descriptors");
  // Nothing reads the removed icon constants either.
  for (const c of ["DF_ICON", "MANUAL_ICON", "RAINBOW_ICON"])
    assert.ok(!landing.includes(c), `landing dropped the unused ${c}`);
});

test("tile subtitles reserve two lines, so names align across a row even when one wraps", () => {
  // Tiles are bottom-anchored: a one-line subtitle next to a two-line one pushed the names out of
  // line with each other. Reserving the height is what keeps the row level at any width.
  const css = read("src/terminal.css"), landing = read("public/landing-next.html");
  const app = css.slice(css.indexOf(".tzone .tsbcell .tsbcellsub{"));
  assert.match(app.slice(0, app.indexOf("}")), /min-height:2\.5em/, "app reserves two lines");
  const land = landing.slice(landing.indexOf(".sbcell .sbcellsub{"));
  assert.match(land.slice(0, land.indexOf("}")), /min-height:2\.5em/, "landing reserves two lines");
  // The reserve is 2 lines at the declared line-height; if one changes the other has to follow.
  for (const [block, label] of [[app.slice(0, app.indexOf("}")), "app"], [land.slice(0, land.indexOf("}")), "landing"]]) {
    const lh = Number(block.match(/line-height:([\d.]+)/)?.[1]);
    const min = Number(block.match(/min-height:([\d.]+)em/)?.[1]);
    assert.equal(min, 2 * lh, `${label} reserve matches two lines of its own line-height`);
  }
});

test("tile subtitles stay at the readable floor, never shrunk to fit", () => {
  // 320px is tight, but the fix there is tracking, not type size: the house rule is no meaningful
  // text below 12px.
  const css = read("src/terminal.css"), landing = read("public/landing-next.html");
  for (const [src, sel, label] of [[css, ".tzone .tsbcell .tsbcellsub{", "app"], [landing, ".sbcell .sbcellsub{", "landing"]]) {
    const at = src.indexOf(sel);
    const size = Number(src.slice(at, src.indexOf("}", at)).match(/font-size:([\d.]+)px/)[1]);
    assert.ok(size >= 12, `${label} subtitle is ${size}px, below the 12px floor`);
  }
  const narrow = landing.match(/@media\(max-width:340px\)\{ \.sbcellsub\{[^}]*\}/)?.[0] || "";
  assert.ok(!/font-size/.test(narrow), "the narrow-width rule adjusts tracking, not size");
});
