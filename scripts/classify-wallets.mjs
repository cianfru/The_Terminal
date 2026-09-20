// EXPERIMENT — can a System One model tell an exchange, a market maker and a person apart?
//
//   node scripts/classify-wallets.mjs            classify the untagged candidates
//   node scripts/classify-wallets.mjs --eval     run the 27 HAND-LABELLED addresses and score it
//   node scripts/classify-wallets.mjs --print    show the exact request, send nothing
//
// WHY THIS ONE FIRST. Tagging infrastructure is the fuzziest judgement in the pipeline and the
// current rule is three thresholds (≥30 transfers each way, ≥25 counterparties) that produce a flat
// list for a human to check on Etherscan. It is also the SAFEST place to try a model: nothing here
// is published. A wrong answer costs one wasted lookup, and EXCLUDE_LABELS still only changes when
// the owner edits it by hand.
//
// ⭐ IT IS MEASURABLE. EXCLUDE_LABELS carries 27 addresses the owner already classified by hand, so
// --eval asks Jev the same question about those and scores it against the answer. An experiment you
// cannot grade is a vibe; this one has a number. The label is NEVER placed in the state.
//
// ⚠ Nothing here writes to EXCLUDE_LABELS, onchain.json or any published figure. Output is a
// review queue.
import { readFileSync, writeFileSync } from "node:fs";
import { ask, choice, noul, hasKey, band, preview } from "./bot/jev.mjs";
import { EXCLUDE_LABELS } from "./build-onchain-local.mjs";

const J = f => { try { return JSON.parse(readFileSync(new URL(`../public/${f}`, import.meta.url), "utf8")); } catch { return null; } };
const sankey = J("cex-sankey.json") || {};
const types = (J("addr-types.json") || {}).types || {};
const whales = (J("whales.json") || {}).wallets || [];
const balOf = Object.fromEntries(whales.map(w => [String(w.a || "").toLowerCase(), w.bal]));

const n = v => (Number.isFinite(v) ? Math.round(v).toLocaleString("en-US") : "unknown");
const pct = v => (Number.isFinite(v) ? v.toFixed(1) + "%" : "unknown");

// How many tagged venues does this address trade with, and on which side? An address that both
// feeds AND drains several different exchanges is routing, not holding — the single most telling
// signal we have, and one no per-address threshold can see.
// venue reach comes from the profile row when the pipeline has emitted one. Falling back to the
// sankey's truncated top-N would report "0 exchanges" for an address that simply missed the cut —
// a false zero is worse than an honest unknown, especially as a model input.
function venueReach(addr, f) {
  if (Number.isFinite(f?.venuesIn) || Number.isFinite(f?.venuesOut)) return { in: f.venuesIn ?? 0, out: f.venuesOut ?? 0, known: true };
  return { in: null, out: null, known: false };
}

/** One address → the plain-language profile Jev reads. Never contains the label. */
function profile(a, f) {
  const reach = venueReach(a, f);
  const vol = Math.max(f.volIn || 0, f.volOut || 0);
  const net = (f.volIn || 0) - (f.volOut || 0);
  const through = vol > 0 ? (1 - Math.abs(net) / vol) * 100 : null;
  const tx = (f.txIn || 0) + (f.txOut || 0);
  const bal = balOf[a.toLowerCase()];
  return [
    `Ethereum address ${a}, holding SPX6900 (an ERC-20 memecoin, ~931M circulating).`,
    `Address type: ${types[a] || types[a.toLowerCase()] || "unknown"} (a contract cannot be a person holding their own bag).`,
    ``,
    `Behaviour over the last ${sankey.window?.days ?? 90} days:`,
    `- transfers in: ${n(f.txIn)}   transfers out: ${n(f.txOut)}`,
    `- distinct counterparties: ${n(f.cp)}`,
    `- volume in: ${n(f.volIn)} SPX    volume out: ${n(f.volOut)} SPX`,
    `- net change: ${n(net)} SPX — ${through == null ? "unknown" : pct(through) + " of its volume passed straight through"}`,
    `- average transfer: ${tx ? n(vol / tx) : "unknown"} SPX`,
    `- current balance: ${bal != null ? n(bal) + " SPX" : "not in the holder set (below the 5,000 SPX floor, or excluded as infrastructure)"}`,
    ``,
    `Relationship to known exchanges:`,
    reach.known
      ? `- sends SPX to ${reach.out} tagged exchange(s), receives from ${reach.in}`
      : `- unknown (this deployment has not rebuilt the profile set yet)`,
  ].join("\n");
}

const QUESTIONS = {
  kind: choice("What kind of actor operates this address, judged only on its on-chain behaviour", {
    cex: "A centralised exchange hot or deposit wallet. Huge two-way volume with very many distinct counterparties; balance is a float, not a position.",
    mm: "A market maker, trading desk or arbitrage bot. High two-way volume, moves between several venues, holds little for long; volume passes through rather than accumulating.",
    router: "A DEX router, aggregator or smart contract that forwards other people's trades. Never holds a meaningful balance of its own.",
    lp: "A liquidity pool contract. Two-way flow driven by swaps against a paired reserve.",
    bridge: "A cross-chain bridge or its custody wallet. Locks supply that is reissued on another chain.",
    person: "An individual or fund holding their own position. Few counterparties, flow mostly one direction, balance accumulates or is drawn down over time.",
  }),
  infra: noul("This address is operated by software or an institution rather than being one person's own bag, and should be excluded from holder counts and concentration statistics."),
};

const argv = process.argv.slice(2);
const EVAL = argv.includes("--eval");
const PRINT = argv.includes("--print");

// ── the subjects ──────────────────────────────────────────────────────────────────────────────
// eval: the hand-labelled set, profiled from the venue flow rows (name stripped from the state).
// live: the untagged candidates the throughput scan already surfaces for review.
function subjects() {
  const profiles = sankey.profiles || null;
  if (profiles) {
    return EVAL
      ? profiles.filter(p => p.kind && p.kind !== "null").map(p => ({ a: p.a, f: p, truth: p.kind, name: EXCLUDE_LABELS[p.a]?.name }))
      : profiles.filter(p => !p.kind).slice(0, 40).map(p => ({ a: p.a, f: p, truth: null }));
  }
  // ── before the next pipeline run there is no profile set. Candidates still work (they carry their
  // own throughput); the EVAL cannot, because the labelled addresses have no comparable features and
  // grading a model on blank inputs measures nothing. Say so rather than produce a meaningless score.
  if (EVAL) {
    console.log("The labelled addresses have no behavioural profile in this build.\n" +
      "cex-sankey.json only carries per-venue display rows, truncated to the top 12, and the\n" +
      "throughput scan used to skip tagged addresses entirely. build-onchain-local.mjs now emits a\n" +
      "`profiles` array covering both — run onchain-dune.yml (or the FIFO engine locally) and the\n" +
      "eval becomes gradeable. Nothing to measure until then.");
    process.exit(0);
  }
  return (sankey.candidates || []).map(c => ({ a: c.a, f: c, truth: null }));
  const flowOf = a => {
    const low = a.toLowerCase();
    const pick = rows => (rows || []).find(r => (r.top || []).some(t => String(t.a).toLowerCase() === low));
    // a tagged venue appears as a NODE in the sankey, so read its own totals
    const asVenue = name => ({
      in: (sankey.inflow || []).find(r => r.venue === name),
      out: (sankey.outflow || []).find(r => r.venue === name),
    });
    return { pick, asVenue };
  };
  return Object.entries(EXCLUDE_LABELS)
    .filter(([, v]) => v.kind && v.kind !== "null")
    .map(([a, v]) => {
      const { asVenue } = flowOf(a);
      const node = asVenue(String(v.name).replace(/\s*\d+$/, "").replace(/ \(.*\)/, ""));
      const cpIn = node.in ? (node.in.top?.length || 0) + (node.in.more?.n || 0) : null;
      const cpOut = node.out ? (node.out.top?.length || 0) + (node.out.more?.n || 0) : null;
      return {
        a, truth: v.kind, name: v.name,
        f: { volIn: node.in?.total, volOut: node.out?.total, cp: (cpIn || 0) + (cpOut || 0) || null, txIn: null, txOut: null },
      };
    });
}

const subs = subjects();
console.log(`${EVAL ? "EVAL — hand-labelled addresses" : "CANDIDATES — untagged, exchange-like throughput"}: ${subs.length}`);
console.log(`jev key present: ${hasKey()}${hasKey() ? "" : "  → shadow mode, showing what WOULD be asked"}\n`);

if (PRINT || !hasKey()) {
  const s = subs[0];
  const p = preview(profile(s.a, s.f), QUESTIONS);
  console.log("──── the state for one address ────\n" + p.body.state);
  console.log("\n──── the questions ────\n" + JSON.stringify(p.body.questions, null, 1).slice(0, 1400));
  console.log(`\nPOST ${p.endpoint}   (${subs.length} calls, ~${Math.round(p.body.state.length / 4 * subs.length / 1000)}k input tokens ≈ $${(p.body.state.length / 4 * subs.length / 1e6 * 0.042).toFixed(4)})`);
  console.log("\nSet TYPESAFE_API_KEY to run it for real.");
  process.exit(0);
}

// ── run it ────────────────────────────────────────────────────────────────────────────────────
const out = [];
for (const s of subs) {
  const res = await ask(profile(s.a, s.f), QUESTIONS);
  if (!res) { console.log(`${s.a.slice(0, 12)}…  no answer (fell back)`); continue; }
  const k = res.answers.kind, infra = res.answers.infra;
  out.push({ a: s.a, truth: s.truth, name: s.name, kind: k.choice, confidence: k.confidence, band: band(k.confidence), infra: infra.noul, probabilities: k.probabilities });
  const mark = s.truth ? (s.truth === k.choice ? "✓" : `✗ (labelled ${s.truth})`) : "";
  console.log(`${s.a.slice(0, 12)}…  ${String(k.choice).padEnd(7)} conf ${k.confidence.toFixed(2)} [${band(k.confidence)}]  infra ${infra.noul.toFixed(2)}  ${mark}`);
}

if (EVAL && out.length) {
  // the model's own labels are coarser than ours: everything we call "cex" it may split into
  // cex/mm/router. Score both strictly and on the question that actually matters — is it infra?
  const strict = out.filter(o => o.kind === o.truth).length;
  const INFRA_TRUTH = new Set(["cex", "lp", "bridge", "burn", "custody"]);
  const infraOk = out.filter(o => (o.infra >= 0.5) === INFRA_TRUTH.has(o.truth)).length;
  console.log(`\nexact kind:  ${strict}/${out.length} (${(strict / out.length * 100).toFixed(0)}%)`);
  console.log(`is-it-infra: ${infraOk}/${out.length} (${(infraOk / out.length * 100).toFixed(0)}%)  ← the decision we actually make`);
  const acted = out.filter(o => o.band === "act");
  if (acted.length) console.log(`high-confidence subset: ${acted.filter(o => o.kind === o.truth).length}/${acted.length} correct`);
}

const path = new URL(`../public/wallet-labels${EVAL ? "-eval" : ""}.json`, import.meta.url);
writeFileSync(path, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), mode: EVAL ? "eval" : "candidates", model: "jev-latest", results: out }, null, 1));
console.log(`\n→ ${path.pathname.split("/").pop()} (a review queue — nothing is tagged automatically)`);
