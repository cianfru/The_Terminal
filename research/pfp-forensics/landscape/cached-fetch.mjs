// A fetch for long Blockscout sweeps: retries with backoff, caches every good response on
// disk, and THROWS instead of returning nothing.
//
// ⚠ kol-cluster's pager makes one attempt per page and stops on a failed one, so a rate
// limit mid-sweep returns a truncated ledger with no error — and a truncated ledger is a
// household with trades missing, classified with confidence. Passed in as fetchImpl, this
// turns every transient failure into a retry and every persistent one into an exception, so
// a household classifies completely or not at all. The cache makes a multi-hour sweep
// resumable and any rerun free; failures are never cached.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export function cachedFetch(dir, { tries = 10 } = {}) {
  mkdirSync(dir, { recursive: true });
  const path = u => join(dir, createHash("sha1").update(u).digest("hex") + ".json");
  let hits = 0, misses = 0;
  const f = async (u, opts) => {
    const p = path(u);
    if (existsSync(p)) { hits++; const body = readFileSync(p, "utf8"); return { ok: true, status: 200, json: async () => JSON.parse(body) }; }
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(u, opts);
        if (r.ok) { const body = await r.text(); JSON.parse(body); writeFileSync(p, body); misses++; return { ok: true, status: 200, json: async () => JSON.parse(body) }; }
        if (r.status === 404) return { ok: false, status: 404, json: async () => null };   // a real answer
      } catch {}
      await new Promise(x => setTimeout(x, Math.min(15000, 600 * 2 ** i)));
    }
    throw new Error(`blockscout unreachable after ${tries} tries: ${u.slice(0, 120)}`);
  };
  f.stats = () => ({ hits, misses });
  return f;
}
