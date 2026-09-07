import { test } from "node:test";
import assert from "node:assert/strict";

// The event-based band accumulation used by bigquery/zcash_hodl_waves.sql and
// bigquery/btc_hodl_waves.sql: emit +v when a UTXO enters an age band and -v when
// it leaves (spent, or aged onward), bucket to weeks, cumulative-sum. Neither SQL
// can run here, so the METHOD is pinned in JS against a brute-force as-of count.
const DAY = 86400e3;
const BOUNDS = [[0,0,30],[1,30,90],[2,90,180],[3,180,365],[4,365,730],[5,730,1825],[6,1825,40000]];
const monday = t => { const d = new Date(t); const w = (d.getUTCDay()+6)%7; return t - w*DAY; };

function eventMethod(utxos, today) {
  const wk = new Map();
  const add = (b,t,v) => { if (t<=today) wk.set(`${b}|${monday(t)}`, (wk.get(`${b}|${monday(t)}`)||0)+v); };
  for (const {v,c,s} of utxos) for (const [b,lo,hi] of BOUNDS) {
    const enter = c + lo*DAY;
    if (s !== null && s <= enter) continue;
    add(b, enter, v);
    add(b, Math.min(s ?? Infinity, c + hi*DAY), -v);
  }
  const weeks = [...new Set([...wk.keys()].map(k => +k.split("|")[1]))].sort((a,b)=>a-b);
  const run = {}, out = new Map();
  for (const w of weeks) for (const [b] of BOUNDS) {
    run[b] = (run[b]||0) + (wk.get(`${b}|${w}`)||0);
    out.set(`${b}|${w}`, run[b]);
  }
  return { out, weeks };
}

const brute = (utxos, asOf) => {
  const o = {};
  for (const {v,c,s} of utxos) {
    if (c > asOf || (s !== null && s <= asOf)) continue;
    const age = Math.floor((asOf - c)/DAY);
    for (const [b,lo,hi] of BOUNDS) if (age>=lo && age<hi) { o[b]=(o[b]||0)+v; break; }
  }
  return o;
};

test("event-based bands equal brute force at END of week (Sunday)", () => {
  let seed = 7; const rnd = () => (seed = (seed*1103515245+12345) & 0x7fffffff) / 0x7fffffff;
  const D0 = Date.UTC(2016,9,28), TODAY = Date.UTC(2026,8,7);
  const span = Math.floor((TODAY-D0)/DAY);
  const utxos = Array.from({length: 1200}, () => {
    const c = D0 + Math.floor(rnd()*span)*DAY;
    const life = rnd() < 0.25 ? null : Math.floor(rnd()*2500)+1;
    let s = life === null ? null : c + life*DAY;
    if (s !== null && s > TODAY) s = null;
    return { v: Math.floor(rnd()*1e6)+1, c, s };
  });

  const { out, weeks } = eventMethod(utxos, TODAY);
  let sundayBad = 0, mondayBad = 0, checked = 0;
  for (let i = 0; i < weeks.length; i += 37) {
    const w = weeks[i];
    if (w + 6*DAY > TODAY) continue;
    checked++;
    const bSun = brute(utxos, w + 6*DAY), bMon = brute(utxos, w);
    for (const [b] of BOUNDS) {
      if (Math.abs((out.get(`${b}|${w}`)||0) - (bSun[b]||0)) > 1e-6) sundayBad++;
      if (Math.abs((out.get(`${b}|${w}`)||0) - (bMon[b]||0)) > 1e-6) mondayBad++;
    }
  }
  assert.ok(checked > 5, `too few weeks checked (${checked})`);
  assert.equal(sundayBad, 0, "weekly rows must equal exact state at end of week");
  assert.ok(mondayBad > 0, "and must NOT equal Monday state — that is the semantic being pinned");
});
