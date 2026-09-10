#!/usr/bin/env node
// Prune old Vercel deployments so function/deployment storage can never accumulate.
//
// WHY: Vercel retains EVERY deployment — and each one keeps its ~12 serverless-function bundles
// (~35 MB) — forever, unless deleted. This repo deploys ~5× a day from crons (snapshot, aeon ×2,
// whale-campaigns, onchain) plus every code push, so retained bundles hit the Hobby ceiling
// (function storage 10 GB, deployment storage 10 GB) in a month or two and Vercel then BLOCKS
// new deployments. Hobby has no automatic retention policy, so we prune ourselves.
//
// WHAT IT KEEPS (never deleted):
//   - anything still in flight (BUILDING / QUEUED / INITIALIZING)
//   - the live production deployment (newest READY with target=production) — and anything aliased
//   - the newest PRUNE_KEEP deployments overall, as rollback candidates (default 6)
// Everything else (older READY / ERROR / CANCELED) is deleted.
//
// Env: VERCEL_TOKEN, VERCEL_ORG_ID (team id), VERCEL_PROJECT_ID; PRUNE_KEEP (default 6);
// DRY_RUN=1 to list what would go without deleting. Runs from .github/workflows/prune-deployments.yml.

const API = "https://api.vercel.com";
const IN_FLIGHT = new Set(["BUILDING", "QUEUED", "INITIALIZING"]);

// Pure: decide which deployments to delete. Exported for the unit test.
export function selectForDeletion(deployments, keep = 6) {
  const byNewest = [...deployments].sort((a, b) => (b.created || 0) - (a.created || 0));
  const keepIds = new Set();
  const live = byNewest.find(d => d.state === "READY" && d.target === "production");
  if (live) keepIds.add(live.uid);
  for (const d of byNewest) {
    if (IN_FLIGHT.has(d.state)) keepIds.add(d.uid);
    if (Array.isArray(d.alias) && d.alias.length) keepIds.add(d.uid);
  }
  for (const d of byNewest.slice(0, keep)) keepIds.add(d.uid);
  return {
    keep: byNewest.filter(d => keepIds.has(d.uid)),
    remove: byNewest.filter(d => !keepIds.has(d.uid)),
    live: live || null,
  };
}

async function api(path, token, init = {}) {
  const r = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${init.method || "GET"} ${path} → HTTP ${r.status} ${await r.text().catch(() => "")}`);
  return r.status === 204 ? null : r.json();
}

// Page through every deployment of the project (v6 paginates with `until`).
async function listAll(token, teamId, projectId) {
  const out = [];
  let until = null;
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ projectId, teamId, limit: "100" });
    if (until) q.set("until", String(until));
    const data = await api(`/v6/deployments?${q}`, token);
    out.push(...(data.deployments || []));
    until = data.pagination?.next;
    if (!until || !(data.deployments || []).length) break;
  }
  return out;
}

async function main() {
  const token = process.env.VERCEL_TOKEN, teamId = process.env.VERCEL_ORG_ID, projectId = process.env.VERCEL_PROJECT_ID;
  const keep = Math.max(1, Number(process.env.PRUNE_KEEP) || 6);
  const dry = process.env.DRY_RUN === "1";
  if (!token || !teamId || !projectId) { console.error("Missing VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID"); process.exit(1); }

  const all = await listAll(token, teamId, projectId);
  const { keep: kept, remove, live } = selectForDeletion(all, keep);
  const when = ms => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
  console.log(`project ${projectId}: ${all.length} deployments · keeping ${kept.length} · removing ${remove.length}${dry ? " (DRY RUN)" : ""}`);
  console.log(`live production: ${live ? `${live.uid} (${when(live.created)})` : "none found"}`);
  for (const d of kept) console.log(`  keep   ${d.uid}  ${when(d.created)}  ${d.state}${d.target === "production" ? "  prod" : ""}`);

  let removed = 0, failed = 0;
  for (const d of remove) {
    if (dry) { console.log(`  would remove ${d.uid}  ${when(d.created)}  ${d.state}`); continue; }
    try {
      await api(`/v13/deployments/${d.uid}?teamId=${encodeURIComponent(teamId)}`, token, { method: "DELETE" });
      removed++;
      console.log(`  removed ${d.uid}  ${when(d.created)}  ${d.state}`);
      await new Promise(r => setTimeout(r, 120)); // be polite to the API
    } catch (e) { failed++; console.warn(`  FAILED ${d.uid}: ${e.message}`); }
  }
  console.log(`done: removed ${removed}, failed ${failed}, kept ${kept.length}`);
  if (failed && !removed) process.exit(1); // total failure = something is wrong (token/perm); partial = fine
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
