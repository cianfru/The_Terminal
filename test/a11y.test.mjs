import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const css = read("src/terminal.css");

test("the manual is themed, not hardcoded dark", () => {
  // 61 nodes at ~1.4:1 on the bright theme — the worst contrast anywhere on the site.
  const d = read("src/DocsPage.jsx");
  assert.match(d, /const DIM = "var\(--ch-mut/);
  assert.match(d, /BODY = "var\(--ch-body/);
  assert.ok(!/const DIM = "#7c8a9e"/.test(d), "no hardcoded dark-theme greys left");
});

test("every vivid accent has a bright-theme value of the same hue", () => {
  const dark = css.match(/:root, \.tzone\{([\s\S]*?)\}/)[1];
  const light = css.match(/html\[data-theme="light"\] \.tzone\{\s*\n\s*\/\*[^\n]*\n([\s\S]*?)\}/)[1];
  const names = [...dark.matchAll(/--acc-([a-z0-9]+):/g)].map(m => m[1]);
  assert.ok(names.length >= 10, `accents defined (${names.length})`);
  for (const n of names) assert.match(light, new RegExp(`--acc-${n}:`), `--acc-${n} has a bright value`);
});

test("bright-theme accent overrides match how React serialises inline colour", () => {
  // React writes `color: rgb(74, 222, 128)`, never the hex — a selector written against the hex
  // matches nothing and fails silently, which is exactly how a phase-3 fix slipped through.
  const rules = [...css.matchAll(/\[style\*="([^"]+)"\]/g)].map(m => m[1]);
  assert.ok(rules.length >= 10, `accent overrides present (${rules.length})`);
  for (const r of rules) assert.match(r, /^rgb\(\d+, \d+, \d+\)$/, `${r} is in the serialised form`);
});

test("a filter is not used to fake contrast", () => {
  // brightness() darkens the pixels but leaves computed colour untouched, so nothing can verify it.
  assert.ok(!/filter:brightness\(\.\d+\) saturate/.test(css), "no unverifiable brightness hack");
});

test("inkColor routes accents through the tokens, keeping the hue as a fallback", async () => {
  const ui = read("src/chart-ui.jsx");
  assert.match(ui, /const ACCENT_VAR = \{/);
  assert.match(ui, /return a \? `var\(--acc-\$\{a\},\$\{k\}\)` : c;/, "falls back to the original hex");
});

test("decorative cursors are hidden from assistive tech", () => {
  assert.match(read("src/chart-ui.jsx"), /<i className="tcur" aria-hidden="true">_<\/i>/);
  assert.match(read("src/App.jsx"), /className="tgcur" aria-hidden="true"/);
});

test("reduced motion stops the ticker and cursors rather than slowing them", () => {
  const l = read("public/landing-next.html");
  assert.match(l, /\.tape\{ animation:none !important; \}/, "the marquee stops");
  assert.match(l, /\.ticker\{ overflow-x:auto/, "and stays readable by scrolling");
  assert.match(l, /#scrollcue[^{]*\{ animation:none !important; \}/, "the scroll cue stops");
  assert.ok(l.includes("if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;"), "the JS typewriter stops too");
  for (const f of ["src/chart-ui.jsx", "src/TerminalNav.jsx"]) {
    assert.match(read(f), /if \(still\) return;/, `${f} typewriter respects the preference`);
  }
});

test("the dialog hook traps, closes on Escape and restores focus", () => {
  const d = read("src/use-dialog.js");
  assert.match(d, /e\.key === "Escape"/);
  assert.match(d, /e\.shiftKey && document\.activeElement === first/, "wraps backwards");
  assert.match(d, /opener\.focus\(\)/, "hands focus back");
  assert.match(d, /const lost = !now \|\| now === document\.body/, "restores when focus was lost");
  assert.match(d, /opener\.isConnected/, "but only to an element that still exists");
  assert.match(d, /node\.contains\(now\)/, "or when focus is still inside the dialog");
  for (const f of ["src/TerminalNav.jsx", "src/FullscreenView.jsx"]) {
    assert.match(read(f), /useDialog\(open, \w+, onClose\)/, `${f} uses it`);
  }
});

test("text inputs are 16px on a phone, so Safari cannot zoom the page", () => {
  // Assert the PROPERTY, not its neighbours: the first version keyed off a comment sitting
  // immediately after the declaration and broke the moment another property was added between.
  const at = css.indexOf(".tzone .tsbsearchin{");
  const block = css.slice(at, css.indexOf("}", at));
  const px = parseFloat((block.match(/font-size:\s*([\d.]+)px/) || [])[1]);
  assert.ok(px >= 16, `springboard search is >=16px (found ${px})`);
  assert.match(read("src/ChartsGallery.jsx"), /fontSize: isMobile \? 16 : 14/, "gallery search");
});

test("the moderated test protocol exists and is listed in the manual", () => {
  const doc = read("docs/mobile-usability-test.md");
  for (const t of ["Understand the offer", "Find a valuation chart", "Zoom into a period"]) {
    assert.ok(doc.includes(t), `task "${t}" is scripted`);
  }
  assert.match(doc, /do not help/, "the no-hints rule is stated");
  assert.match(doc, /Known gaps to watch for/, "open gaps are disclosed to the moderator");
  assert.match(read("docs/SUMMARY.md"), /mobile-usability-test\.md/);
});
