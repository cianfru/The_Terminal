// INCIDENT RECORD — builds a platform-appeal document from a structured log of what happened.
//
//   node scripts/incident-report.mjs --init     write a blank intake file to fill in
//   node scripts/incident-report.mjs            read it and produce tools/incident/report.md
//
// ⚠ EVERYTHING IT READS AND WRITES LIVES IN tools/incident/, WHICH IS GITIGNORED. This repo is
// public; the working file holds third-party handles, timestamps and screenshot paths, and a
// dossier on named individuals must never be published by accident. The script itself carries no
// personal data, so it is committed; the record is not.
//
// WHAT AN APPEAL ACTUALLY NEEDS. Not indignation, and not the identity of one person — platforms
// act on PATTERN. Three things carry weight:
//   1. a timeline a stranger can follow without context
//   2. evidence that the reports were COORDINATED rather than many people independently objecting
//   3. a specific, checkable ask
// So the generator does the pattern work: it finds bursts (many accounts acting inside one short
// window), shared phrasing (the same sentences from different handles = a template, the single
// strongest signal of organisation), and account-age clustering (a cohort created together).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "tools/incident");
const IN = join(DIR, "incident.json");
const OUT = join(DIR, "report.md");

const TEMPLATE = {
  subject: {
    handle: "@SPX6900Rainbow",
    what_it_is: "An independent on-chain analytics account for the SPX6900 token. Publishes daily charts and methodology; every figure is reproducible from public blockchain data at spx6900rainbow.xyz.",
    account_age: "",                       // "created 2026-05" — context for a clean record
    suspended_at: "",                      // ISO, e.g. "2026-09-18T09:20:00Z"
    restored_at: "",                       // ISO, when it came back
    stated_reason: "",                     // exactly what the notice said, verbatim
    prior_actions: "none",                 // any earlier strikes — be straight about it
  },
  // One row per thing that happened. Keep `text` verbatim — the phrasing analysis depends on it.
  // kind: post | reply | quote | dm | report-notice | suspension | restoration | other
  events: [
    { at: "2026-09-16T14:02:00Z", kind: "post", who: "@SPX6900Rainbow", text: "the post that drew the response", url: "", screenshot: "", note: "" },
    { at: "2026-09-16T14:40:00Z", kind: "reply", who: "@example1", text: "paste the reply verbatim", url: "", screenshot: "", note: "" },
  ],
  // Optional. Anything you can see publicly on each account — age and follower count are what
  // reveal a cohort. Leave a field blank if you do not know it; blanks are reported as unknown.
  accounts: [
    { handle: "@example1", created: "", followers: null, note: "" },
  ],
  impact: [
    "Account unreachable for N hours; the daily publication missed N days.",
  ],
  ask: "Review the reports against this account as a coordinated campaign rather than individual complaints, and restore the account's standing.",
};

if (process.argv.includes("--init")) {
  mkdirSync(DIR, { recursive: true });
  if (existsSync(IN)) { console.log(`${IN} already exists — not overwriting.`); process.exit(0); }
  writeFileSync(IN, JSON.stringify(TEMPLATE, null, 2));
  console.log(`→ ${IN}\n\nFill it in, then run: node scripts/incident-report.mjs`);
  console.log("This directory is gitignored. Nothing in it can be committed.");
  process.exit(0);
}

let data;
try { data = JSON.parse(readFileSync(IN, "utf8")); }
catch { console.log(`No intake file. Run:\n  node scripts/incident-report.mjs --init`); process.exit(1); }

const ev = (data.events || []).filter(e => e.at).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
const T = s => new Date(s).toISOString().replace("T", " ").slice(0, 16) + "Z";
const mine = String(data.subject?.handle || "").toLowerCase();
const others = ev.filter(e => String(e.who || "").toLowerCase() !== mine && e.who);

// ── bursts: many DISTINCT accounts inside one window ──────────────────────────────────────────
// One person replying ten times is an argument. Ten accounts replying inside an hour, to a post
// that had been quiet, is organisation. Distinct handles is the thing to count, not messages.
function bursts(list, minutes = 60, min = 3) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const t0 = Date.parse(list[i].at);
    const win = list.filter(e => { const d = Date.parse(e.at) - t0; return d >= 0 && d <= minutes * 60000; });
    const who = [...new Set(win.map(e => e.who))];
    if (who.length >= min) out.push({ from: list[i].at, to: win.at(-1).at, accounts: who, n: win.length });
  }
  // keep only the widest window of each overlapping run
  return out.filter((b, i) => !out.some((o, j) => j !== i && o.accounts.length >= b.accounts.length &&
    Date.parse(o.from) <= Date.parse(b.from) && Date.parse(o.to) >= Date.parse(b.to) && (o.accounts.length > b.accounts.length || j < i)));
}

// ── shared phrasing: the same wording from different accounts ─────────────────────────────────
// The strongest single piece of evidence. People who independently object phrase it differently;
// people working from a script do not.
const norm = s => String(s || "").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
function sharedPhrases(list, n = 5) {
  const byGram = new Map();
  for (const e of list) {
    const w = norm(e.text).split(" ").filter(Boolean);
    const seen = new Set();
    for (let i = 0; i + n <= w.length; i++) {
      const g = w.slice(i, i + n).join(" ");
      if (seen.has(g)) continue;
      seen.add(g);
      if (!byGram.has(g)) byGram.set(g, new Set());
      byGram.get(g).add(e.who);
    }
  }
  // One shared sentence yields a dozen overlapping n-grams. Listing them all reads as padding and
  // weakens the point, so grams shared by the SAME set of accounts are chained back into the
  // longest run they came from, and each set is reported once.
  const groups = new Map();
  for (const [g, who] of byGram) {
    if (who.size < 2) continue;
    const key = [...who].sort().join("|");
    if (!groups.has(key)) groups.set(key, { accounts: [...who].sort(), grams: [] });
    groups.get(key).grams.push(g);
  }
  const out = [];
  for (const { accounts, grams } of groups.values()) {
    let parts = grams.slice();
    for (let pass = 0; pass < 40; pass++) {
      let joined = false;
      outer: for (let i = 0; i < parts.length; i++) {
        for (let j = 0; j < parts.length; j++) {
          if (i === j) continue;
          const a = parts[i].split(" "), b = parts[j].split(" ");
          if (a.slice(1).join(" ") === b.slice(0, -1).join(" ")) {
            parts[i] = a.concat(b.at(-1)).join(" ");
            parts.splice(j, 1);
            joined = true;
            break outer;
          }
        }
      }
      if (!joined) break;
    }
    // drop anything now contained in a longer sibling
    parts = parts.filter((x, i) => !parts.some((y, j) => j !== i && y.length > x.length && y.includes(x)));
    parts.sort((a, b) => b.length - a.length);
    out.push({ phrase: parts[0], also: parts.slice(1), accounts });
  }
  return out.sort((a, b) => b.accounts.length - a.accounts.length || b.phrase.length - a.phrase.length).slice(0, 8);
}

const B = bursts(others), P = sharedPhrases(others);
const accts = data.accounts || [];
const known = accts.filter(a => a.created);
const byMonth = {};
for (const a of known) { const m = String(a.created).slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; }
const cohort = Object.entries(byMonth).sort((a, b) => b[1] - a[1]);

const L = [];
L.push(`# Appeal — ${data.subject?.handle || "(handle)"}`, "");
L.push(`**Prepared** ${new Date().toISOString().slice(0, 10)}`, "");
L.push(`## What the account is`, "", data.subject?.what_it_is || "", "");
if (data.subject?.account_age) L.push(`Account age: ${data.subject.account_age}. Prior enforcement: ${data.subject.prior_actions || "none"}.`, "");
L.push(`## What happened`, "");
L.push(`| when (UTC) | who | what |`, `|---|---|---|`);
for (const e of ev) {
  const who = e.who === data.subject?.handle ? "**me**" : (e.who || "—");
  const txt = String(e.text || e.note || e.kind).replace(/\s+/g, " ").slice(0, 120);
  L.push(`| ${T(e.at)} | ${who} | ${e.kind === "suspension" ? "**SUSPENDED** — " : e.kind === "restoration" ? "**restored** — " : ""}${txt} |`);
}
L.push("");
if (data.subject?.suspended_at) {
  const hrs = data.subject.restored_at ? ((Date.parse(data.subject.restored_at) - Date.parse(data.subject.suspended_at)) / 3.6e6).toFixed(0) : null;
  L.push(`Suspended ${T(data.subject.suspended_at)}${data.subject.restored_at ? `, restored ${T(data.subject.restored_at)} — ${hrs} hours` : ""}.`,
    data.subject.stated_reason ? `Stated reason, verbatim: "${data.subject.stated_reason}"` : "", "");
}

L.push(`## Why this was coordinated, not many people objecting`, "");
if (B.length) {
  L.push(`**Activity arrived in bursts.**`, "");
  for (const b of B.slice(0, 5)) {
    const span = Math.max(1, Math.round((Date.parse(b.to) - Date.parse(b.from)) / 60000));
    L.push(`- ${b.accounts.length} separate accounts inside ${span} minute${span === 1 ? "" : "s"} (${T(b.from)}): ${b.accounts.join(", ")}`);
  }
  L.push("");
} else L.push(`_No burst detected in the events logged — add more timestamps if the clustering was real._`, "");

if (P.length) {
  L.push(`**The same wording appears across different accounts.** Independent complaints do not share sentences.`, "");
  for (const p of P.slice(0, 6)) {
    L.push(`- "${p.phrase}" — used by ${p.accounts.length}: ${p.accounts.join(", ")}`);
    for (const a of p.also.slice(0, 2)) L.push(`  - and "${a}"`);
  }
  L.push("");
} else L.push(`_No shared phrasing found — make sure \`text\` is pasted verbatim, not summarised._`, "");

if (cohort.length) {
  L.push(`**Account ages.** ${known.length} of ${accts.length} accounts have a known creation date.`, "");
  for (const [m, n] of cohort.slice(0, 6)) L.push(`- ${n} created ${m}`);
  L.push("");
}
L.push(`Accounts involved: ${accts.length || others.length ? [...new Set(others.map(e => e.who))].length : 0}.`, "");

L.push(`## Impact`, "");
for (const i of data.impact || []) L.push(`- ${i}`);
L.push("", `## Ask`, "", data.ask || "", "");
L.push(`## Evidence`, "");
const shots = ev.filter(e => e.screenshot || e.url);
if (shots.length) for (const e of shots) L.push(`- ${T(e.at)} — ${e.screenshot || ""} ${e.url ? `(${e.url})` : ""}`.trim());
else L.push(`_Add \`screenshot\` and \`url\` to events. An appeal with links a reviewer can open beats one without._`);

mkdirSync(DIR, { recursive: true });
writeFileSync(OUT, L.join("\n"));
console.log(`→ ${OUT}`);
console.log(`   ${ev.length} events · ${[...new Set(others.map(e => e.who))].length} other accounts · ${B.length} burst(s) · ${P.length} shared phrase(s)`);
if (!P.length && others.length) console.log(`   ⚠ no shared phrasing — paste reply text verbatim, that analysis is the strongest part`);
