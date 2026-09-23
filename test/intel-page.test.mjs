// The traffic dashboard ships its whole UI as one classic <script> inside a TEMPLATE LITERAL. That
// combination has bitten this file twice: a top-level name that collides with a window property
// ("top"), and a quote escaped for the browser that collapses to a bare quote in the template and
// closes the string early. Both are PARSE errors, and a parse error blanks the entire page while the
// endpoint still answers 200 — so nothing upstream notices.
//
// This compiles the script the way a browser would. It does not run it; it only proves it parses.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../api/intel.js", import.meta.url), "utf8");

// PAGE is a template literal; pull the <script> body out of the rendered HTML it produces.
const scripts = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

test("the dashboard ships exactly one inline script", () => {
  assert.equal(scripts.length, 1, "one script block — if this changes, the checks below need revisiting");
});

test("that script PARSES — a syntax error blanks the page while /api/intel still returns 200", () => {
  // `${...}` inside the template literal are server-side interpolations; blank them out so what we
  // compile is the shape the browser receives.
  const body = scripts[0].replace(/\$\{[^}]*\}/g, '""');
  assert.doesNotThrow(() => new vm.Script(body), "the dashboard script must be syntactically valid");
});

test("no top-level declaration collides with a window property", () => {
  // In a CLASSIC script, `const top = …` is a redeclaration of window.top and throws at parse time.
  const body = scripts[0].replace(/\$\{[^}]*\}/g, '""');
  const declared = [...body.matchAll(/^\s*(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  const WINDOW_PROPS = new Set(["top", "self", "parent", "name", "length", "status", "origin", "closed", "frames", "history", "location", "external", "event"]);
  const clash = declared.filter(d => WINDOW_PROPS.has(d));
  assert.deepEqual(clash, [], `these shadow a window property and will not parse: ${clash.join(", ")}`);
});

test("no inline event handler — they need quote escaping the template literal eats", () => {
  // The site switcher shipped broken exactly this way. Delegated listeners need no quotes at all.
  assert.doesNotMatch(scripts[0], /\bon(?:click|change|input|submit)\s*=\s*\\?["']/,
    "build handlers with addEventListener / el.onclick, never an inline on* attribute in a JS string");
});

test("every function an element calls by name is defined in the same script", () => {
  const body = scripts[0];
  // the static markup uses onclick="load()" etc. — those names must exist as globals in the script
  // a handler may contain real JS ("if(event.key==='Enter')load()"), so keywords are not callees
  const KEYWORDS = new Set(["if", "for", "while", "switch", "return", "typeof", "catch"]);
  const called = [...src.matchAll(/on(?:click|keydown)="(?:[^"]*?[;)]\s*)?(\w+)\(/g)].map(m => m[1]).filter(n => !KEYWORDS.has(n));
  assert.ok(called.length, "at least one handler is wired from the markup");
  for (const fn of new Set(called)) {
    assert.match(body, new RegExp(`(?:function|const|var|let)\\s+${fn}\\b`), `${fn}() is called from markup but never defined`);
  }
});
