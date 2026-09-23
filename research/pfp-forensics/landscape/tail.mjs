// Top up the SPX transfer archive from Blockscout, newest back to the archive's last row.
//   node research/pfp-forensics/landscape/tail.mjs --since="2026-08-26 05:46:47" --out=tail.csv
//
// ⚠ The release asset stopped growing when the daily pipeline moved to BigQuery (the BQ table
// became the archive), so it ends 2026-08-26. This fills the gap. Same columns as the archive
// plus the transaction hash, which the archive never carried.
//
// Completeness is pagination exhaustion or reaching the boundary — never "a request failed",
// which looks identical to "no more transfers" and would silently drop the newest weeks.
import { writeFileSync } from "node:fs";
const SPX = "0xE0f63A424a4439cBE457d80e4f4b51ad25b2c56C";
const BS = "https://eth.blockscout.com/api/v2";
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=") || d;
const since = Date.parse(arg("since").replace(" UTC", "").replace(" ", "T") + "Z");
const out = arg("out", "tail.csv");
const j = async u => {
  for (let i = 0; i < 10; i++) {
    try { const r = await fetch(u, { headers: { accept: "application/json" } }); if (r.ok) return r.json(); }
    catch {}
    await new Promise(x => setTimeout(x, Math.min(10000, 700 * 2 ** i)));
  }
  throw new Error("blockscout unreachable after retries — refusing to write a truncated tail");
};
const rows = ["sender,receiver,time,value,tx"];
let p = null, n = 0, oldest = Infinity, reached = false;
while (true) {
  const d = await j(`${BS}/tokens/${SPX}/transfers` + (p ? "?" + new URLSearchParams(p) : ""));
  for (const t of d.items || []) {
    const ts = Date.parse(t.timestamp);
    oldest = Math.min(oldest, ts);
    if (ts <= since) { reached = true; continue; }
    rows.push([t.from?.hash?.toLowerCase(), t.to?.hash?.toLowerCase(),
      new Date(ts).toISOString().replace("T", " ").replace(".000Z", " UTC"), t.total?.value, t.transaction_hash].join(","));
  }
  n++;
  if (n % 50 === 0) process.stderr.write(`  page ${n} · ${rows.length - 1} rows · back to ${new Date(oldest).toISOString().slice(0, 16)}\n`);
  if (reached) break;
  if (!d.next_page_params) throw new Error("feed ended before reaching the archive boundary — gap would remain");
  p = d.next_page_params;
}
writeFileSync(out, rows.join("\n") + "\n");
console.error(`done · ${rows.length - 1} transfers after ${new Date(since).toISOString()} · ${n} pages -> ${out}`);
