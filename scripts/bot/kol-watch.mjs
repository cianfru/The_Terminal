#!/usr/bin/env node
// ============================================================================
// KOL WATCH — a tracked PFP household just sold. Post it, with the receipt.
// ============================================================================
//   node scripts/bot/kol-watch.mjs [--token=2451] [--dry-run] [--force]
//
// Fires on a SELL of any size by any wallet in a tracked cluster. Not transfers: a sell
// means SPX left the household into a pool or a settlement contract, classified at the
// transaction level (see kol-cluster.mjs — the "transfer to a pool = sale" shortcut is
// wrong twice over and a wallet hop is not a decision).
//
// CADENCE. Measured on cluster #2451: 99 external moves over ~3 years, recently ~1-2 a
// month. No size floor by owner's call — small sells still read as a decision from a
// household that has sold 77% of what it bought. The LANE caps it at one post per day
// whatever happens, and every fired sale is remembered so it can never post twice.
//
// ⚠⚠ DISARMED 2026-09-22 AT THE SUBJECT'S REQUEST. The wallet this watched asked not to
// be followed. DISARMED below is the hard stop: the script exits before reading any
// ledger, so it does not merely refrain from posting — it stops LOOKING. Monitoring
// somebody who asked you not to is the thing they objected to, whether or not you publish
// what you see.
//
// Re-arming is a deliberate edit here and in .github/workflows/kol-watch.yml, whose
// schedule is removed. Do not do it without the subject's agreement.
//
// KILL SWITCH (retained, now secondary): KOL_WATCH_DRY_RUN=1 or DRY_RUN=1 renders the card
// and posts nothing.
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { clusterOf, tradeHistory, sells, buys } from "./kol-cluster.mjs";
import { renderKolSaleCard } from "./kol-sale-card.mjs";
import { postWithMedia } from "./media.mjs";
import { lanePostedToday, recordLanePost, withFooter } from "./posts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const STATE = join(ROOT, "public/kol-watch-state.json");
const PRICES = join(ROOT, "public/price-history.json");
const RARITY = join(ROOT, "public/aeon-rarity.json");
const LANE = "kolwatch";
const FRESH_DAYS = 4;                 // only fire on a sale that is genuinely recent

/** Disarmed by default. A flag in the environment cannot turn this back on; only editing
 *  this constant can, which is deliberate — it makes re-arming a decision somebody signs
 *  their name to in a diff, not a variable toggled in a settings page. */
export const DISARMED = true;

const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=")[1];
const dryRun = process.env.DRY_RUN === "1" || process.env.KOL_WATCH_DRY_RUN === "1" || process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

const readJson = (p, fb) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fb; } };

/** Sales already posted, so the same one never fires twice. */
export function loadState(file = STATE) { return readJson(file, { posted: [] }); }
export function alreadyPosted(state, tx) { return (state.posted || []).some(p => p.tx === tx); }
export function recordPosted(state, { tx, token, qty, ts }, cap = 200) {
  const posted = [{ tx, token, qty, ts, at: new Date().toISOString() }, ...(state.posted || [])];
  return { ...state, posted: posted.slice(0, cap) };
}

/** The newest unposted sell inside the freshness window. Pure; unit-tested. */
export function pickSale(rows, state, { now = Date.now(), freshDays = FRESH_DAYS } = {}) {
  const cut = now - freshDays * 864e5;
  return sells(rows)
    .filter(r => Date.parse(r.ts) >= cut && !alreadyPosted(state, r.tx))
    .sort((a, b) => b.ts.localeCompare(a.ts))[0] || null;
}

/** Three lines: hero / what it means / the receipt. The hash is the point — check it yourself. */
export function copyFor({ token, rank, qty, usd, tx }) {
  const f = n => Math.round(n).toLocaleString();
  // ⚠ ONE number, and it is the event itself — a single transaction anyone can open.
  // Aggregate totals are deliberately absent: "bought X, sold Y, holds Z" invites a
  // subtraction that does not close without the transfer legs, and a reader who does that
  // sum concludes the account cannot count. The chart shows the history; the hash proves it.
  return [
    `🔴 The wallet behind AEON #${token} just sold ${f(qty)} SPX${usd ? ` (~$${f(usd)})` : ""}.`,
    `Same household we traced from the profile picture \u2014 AEON #${token}, rank ${rank} of 3,333. The chart is every buy and sell it has ever made.`,
    `Check it yourself: https://etherscan.io/tx/${tx}`,
  ].join("\n");
}

async function main() {
  const token = Number(arg("token") || 2451);
  const cluster = clusterOf(token);
  const px = readJson(PRICES, []);
  const P = new Map(px.map(r => [r.date.slice(0, 10), r.price]));
  const days = [...P.keys()].sort();
  const priceOn = d => P.get(d) ?? P.get(days.filter(x => x <= d).pop()) ?? null;

  const rows = (await tradeHistory(cluster.wallets))
    .map(r => ({ ...r, price: priceOn(r.ts.slice(0, 10)) }));
  const state = loadState();
  // --fresh-days widens the window for a dispatch or a preview. The schedule keeps the
  // tight default so a stale sale can never surface as news.
  const freshDays = Number(arg("fresh-days") || FRESH_DAYS);
  const sale = pickSale(rows, state, { freshDays });
  if (!sale) { console.log(`kol-watch #${token}: no fresh unposted sell in the last ${freshDays} days`); return; }
  if (!force && lanePostedToday(LANE)) { console.log(`kol-watch: lane ${LANE} already posted today`); return; }

  const trades = rows.filter(r => r.kind === "buy" || r.kind === "sell");
  const rarity = readJson(RARITY, { tokens: [] });
  const meta = (rarity.tokens || []).find(t => t.id === token) || {};

  const png = await renderKolSaleCard({
    token, rank: meta.rank ?? "?", artUrl: meta.img,
    prices: px.filter(r => r.date >= "2023-10-01"), trades, event: sale,
    spot: px.at(-1)?.price,
  });
  const text = withFooter(copyFor({
    token, rank: meta.rank ?? "?", qty: sale.qty, usd: sale.price ? sale.qty * sale.price : null, tx: sale.tx,
  }));

  if (dryRun) {
    const out = join(ROOT, "kol-sale-preview.png");
    writeFileSync(out, png);
    console.log(`kol-watch #${token}: DRY RUN — would post the ${Math.round(sale.qty).toLocaleString()} SPX sell from ${sale.ts.slice(0, 10)}`);
    console.log(`\n${text}\n\n-> ${out}`);
    return;
  }
  const tweetId = await postWithMedia(text, png);
  writeFileSync(STATE, JSON.stringify(recordPosted(state, { tx: sale.tx, token, qty: sale.qty, ts: sale.ts }), null, 1));
  recordLanePost(LANE, `kolwatch-${token}`);
  console.log(`kol-watch #${token}: posted ${tweetId}`);
}

// ⚠ THE GUARD BELONGS ON EXECUTION, NOT ON IMPORT. Placing it at module scope exited the
// process the moment a test imported this file: the suite went 479 -> 466 and Node reported
// the truncated file as "1 test, passed". A disarm that quietly deletes its own tests is
// not a disarm anybody can verify.
if (import.meta.url === `file://${process.argv[1]}`) {
  if (DISARMED) {
    console.log("kol-watch is DISARMED at the subject's request — not reading, not posting.");
    process.exit(0);
  }
  main().catch(e => { console.error("kol-watch failed:", e.message); process.exit(0); });
}
