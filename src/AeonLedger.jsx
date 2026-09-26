// AEON Ledger — every AEON owner's SPX record, reconstructed from the chain and reconciled to it.
//
// The question the owner asked: across the whole collection, is the SPX being HELD or SOLD? Each owner is
// a "household": the AEON-holding wallet plus the wallets structurally linked to it (drains, vaults,
// consolidations — research/pfp-forensics/landscape/). Every household's ledger is summed and checked
// against its on-chain balance before it counts; one that does not reconcile is listed, never guessed.
//
// FULLY PUBLIC (owner decision 2026-09-23): every owner, their wallets, figures and trade charts. It is
// public chain data — the ledger only reconstructs it. (A same-day first version walled addresses and all
// but the top 10 behind the members login; the owner reversed that.)
//
// Built by landscape/export.mjs → public/aeon-ledger.json; refreshed by aeon-ledger.yml (dispatch).
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { SANS, MONO, MAX_W, ViewTabs } from "./chart-ui.jsx";
import OwnerList from "./AeonLedgerOwners.jsx";
import { OWNER_SORTS } from "./aeon-ledger-pos.js";

// Find an AEON, embedded (owner, 2026-09-24): same component as ?chart=aeonfind, loaded only when opened.
const AeonFinder = lazy(() => import("./AeonFinder.jsx"));

const INK = "var(--ch-ink,#fff)", BODY = "var(--ch-body,#e2e9f2)", MUT = "var(--ch-mut,#d0d9e6)", DIM = "var(--ch-dim,#b1bccc)";
const LINE = "rgba(148,163,184,0.28)";
const V = {
  "never-sold": { label: "Never sold", color: "#34d399", def: "Bought or received SPX and has not sold any." },
  holding:      { label: "Holding",    color: "#38bdf8", def: "Sold some, still holds at least half of everything that came in." },
  trimming:     { label: "Trimming",   color: "#fbbf24", def: "Still holds some, but less than half of what came in." },
  exited:       { label: "Exited",     color: "#fb7185", def: "Holds less than 1 SPX today." },
};
const ORDER = ["never-sold", "holding", "trimming", "exited"];

const big = n => {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e8 ? 0 : 1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + "k";
  return Math.round(n).toLocaleString("en-US");
};
const usd = n => "$" + big(n);
const pct = x => Math.round(x * 100) + "%";

function Chip({ v }) {
  const m = V[v];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 13, color: INK, whiteSpace: "nowrap" }}>
      <i style={{ width: 9, height: 9, background: m.color, display: "inline-block", flex: "none" }} />{m.label}
    </span>
  );
}

/** SPX sent to exchanges: tagged exchange wallets + inferred deposit addresses, net of withdrawals (cex-out.mjs). */
function ExchangeFlows({ c, isMobile }) {
  const venues = Object.entries(c.venues || {}).filter(([, q]) => q >= 1).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const top = venues[0]?.[1] || 1;
  const cell = (label, value, sub, color = INK) => (
    <div style={{ minWidth: 130 }}>
      <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: MUT }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 13, color: DIM }}>{sub}</div>}
    </div>
  );
  return (
    <div style={{ marginTop: 26, borderTop: `1px solid ${LINE}`, paddingTop: 18 }}>
      <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: INK, fontWeight: 600 }}>Sent to exchanges · likely sold</div>
      <p style={{ fontFamily: SANS, fontSize: 14, color: MUT, margin: "4px 0 12px" }}>{c.owners} owners · a deposit can still come back, so this is not counted as sold.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? "14px 22px" : "14px 40px" }}>
        {cell("Sent", big(c.sent) + " SPX", usd(c.sentUsd) + " at the time")}
        {cell("Withdrawn back", big(c.back) + " SPX", "from exchange wallets")}
        {cell("Net to exchanges", big(c.net) + " SPX", usd(c.netUsd) + " at the time", "#fbbf24")}
      </div>
      {venues.length > 0 && (
        <div style={{ marginTop: 16, display: "grid", gap: 6, maxWidth: 560 }}>
          {venues.map(([v, q]) => (
            <div key={v} style={{ display: "grid", gridTemplateColumns: "96px 1fr 70px", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: SANS, fontSize: 14, color: BODY }}>{v}</span>
              <div style={{ height: 12, background: "rgba(148,163,184,0.12)" }}><div style={{ width: `${(q / top) * 100}%`, height: "100%", background: "#fbbf24" }} /></div>
              <span style={{ fontFamily: MONO, fontSize: 14, color: INK, textAlign: "right" }}>{big(q)}</span>
            </div>
          ))}
          <div style={{ fontFamily: SANS, fontSize: 13, color: DIM }}>Sent by venue, before withdrawals</div>
        </div>
      )}
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h3 style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: INK, margin: "0 0 4px", fontWeight: 600 }}>{title}</h3>
      {sub && <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.6, color: MUT, margin: "0 0 14px", maxWidth: 760 }}>{sub}</p>}
      {children}
    </section>
  );
}

/** Two bars on one scale: bought vs sold. */
function Versus({ label, a, b, fmt }) {
  const max = Math.max(a, b) || 1;
  const row = (name, v, color) => (
    <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 76px", alignItems: "center", gap: 10, marginTop: 6 }}>
      <span style={{ fontFamily: SANS, fontSize: 14, color: BODY }}>{name}</span>
      <div style={{ height: 14, background: "rgba(148,163,184,0.12)" }}><div style={{ width: `${(v / max) * 100}%`, height: "100%", background: color }} /></div>
      <span style={{ fontFamily: MONO, fontSize: 14, color: INK, textAlign: "right" }}>{fmt(v)}</span>
    </div>
  );
  return (
    <div style={{ flex: "1 1 280px", minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: MUT }}>{label}</div>
      {row("Bought", a, "#34d399")}
      {row("Sold", b, "#fb7185")}
      <div style={{ fontFamily: SANS, fontSize: 14, color: BODY, marginTop: 8 }}>
        {a >= b ? `Bought ${(a / b).toFixed(2)}× what was sold` : `Sold ${(b / a).toFixed(2)}× what was bought`}
      </div>
    </div>
  );
}

const th = { padding: "8px 10px", fontFamily: SANS, fontSize: 13, fontWeight: 600, color: MUT, textAlign: "right", whiteSpace: "nowrap", borderBottom: `1px solid ${LINE}` };
const td = { padding: "9px 10px", fontFamily: MONO, fontSize: 14, color: INK, textAlign: "right", whiteSpace: "nowrap", borderBottom: `1px solid ${LINE}` };

export default function AeonLedger({ isMobile }) {
  const [d, setD] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("holds");
  const q = (() => { try { return new URLSearchParams(window.location.search); } catch { return new URLSearchParams(); } })();
  // ?owner=N opens that owner's record straight away; ?find=1 opens the finder
  const [sheetN, setSheetN] = useState(() => Number(q.get("owner")) || null);
  const [find, setFind] = useState(() => q.get("find") === "1");
  useEffect(() => {
    let off = false;
    fetch("/aeon-ledger.json", { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(x => { if (!off) setD(x && Array.isArray(x.owners) ? x : { empty: true }); });
    return () => { off = true; };
  }, []);

  const rows = useMemo(() => {
    if (!d?.owners) return [];
    const key = (OWNER_SORTS.find(x => x[0] === sort) || OWNER_SORTS[0])[2];
    return d.owners.filter(o => filter === "all" || o.verdict === filter).sort((a, b) => key(b) - key(a) || a.n - b.n);
  }, [d, filter, sort]);

  if (!d) return <div style={{ textAlign: "center", fontFamily: SANS, color: MUT, padding: 60 }}>Loading the ledger…</div>;
  if (d.empty || !d.owners) return <div style={{ textAlign: "center", fontFamily: SANS, color: MUT, padding: 60 }}>The ledger is being rebuilt.</div>;

  const t = d.totals, s = d.scope, h = d.holding;
  const years = Object.entries(d.years || {}).sort(([a], [b]) => a.localeCompare(b));
  const vCount = ORDER.map(k => ({ k, ...(d.byVerdict[k] || { households: 0, holds: 0 }) }));
  const totalHH = vCount.reduce((a, v) => a + v.households, 0) || 1;

  const exited = d.byVerdict.exited?.households || 0;
  const stat = (v, l, c = INK) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 7, whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: MONO, fontSize: isMobile ? 18 : 20, fontWeight: 700, color: c }}>{v}</span>
      <span style={{ fontFamily: SANS, fontSize: 14, color: MUT }}>{l}</span>
    </div>
  );
  return (
    <div style={{ maxWidth: Math.min(MAX_W, 1100), margin: "0 auto" }}>
      {/* the owners come first; everything else is below the list */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, auto)", justifyContent: isMobile ? "stretch" : "center",
        gap: isMobile ? "8px 14px" : "10px 34px", margin: "4px 0 16px" }}>
        {stat(s.withSpx.toLocaleString(), "owners")}
        {stat(pct(h.owners / s.withSpx), "still hold SPX", "#38bdf8")}
        {stat(pct(exited / s.withSpx), "exited", "#fb7185")}
        {d.cex ? stat(big(d.cex.net), "SPX to exchanges", "#fbbf24") : stat(big(t.holds), "SPX held", "#34d399")}
      </div>
      <div style={{ display: "flex", justifyContent: "center", margin: "0 0 14px" }}>
        <button type="button" onClick={() => setFind(!find)} aria-expanded={find} aria-controls="al-find"
          style={{ minHeight: 44, padding: "0 18px", cursor: "pointer", fontFamily: SANS, fontSize: 15, fontWeight: 600, width: isMobile ? "100%" : "auto",
            background: find ? "rgba(45,212,191,0.16)" : "transparent", color: INK, border: "1px solid #2dd4bf" }}>
          {find ? "Close the finder" : "Find an AEON from a picture"}
        </button>
      </div>
      {find && (
        <section id="al-find" aria-label="Find an AEON" style={{ border: `1px solid ${LINE}`, padding: isMobile ? "14px 12px" : "18px 20px", margin: "0 0 20px" }}>
          <p style={{ fontFamily: SANS, fontSize: 15, color: BODY, margin: "0 0 14px" }}>Pick the traits you can see; each list shows only what is still possible. One piece left = its owner.</p>
          <Suspense fallback={<div style={{ fontFamily: SANS, color: MUT, padding: 24, textAlign: "center" }}>Loading…</div>}>
            <AeonFinder isMobile={isMobile} ledger={d} onOwner={o => setSheetN(o.n)} embedded />
          </Suspense>
        </section>
      )}
      <ViewTabs tabs={[["all", "All"], ...ORDER.map(k => [k, V[k].label])]} value={filter} onChange={setFilter} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: isMobile ? "flex-start" : "center", gap: 8, margin: "10px 0 12px", fontFamily: SANS, fontSize: 14, color: MUT,
        overflowX: "auto", whiteSpace: "nowrap", paddingBottom: 2 }}>
        Sort
        {OWNER_SORTS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSort(k)} aria-pressed={sort === k} style={{ minHeight: 40, padding: "0 12px", cursor: "pointer", fontFamily: SANS, fontSize: 14, flex: "none",
            background: sort === k ? "rgba(45,212,191,0.16)" : "transparent", color: INK, border: `1px solid ${sort === k ? "#2dd4bf" : LINE}` }}>{l}</button>
        ))}
      </div>
      <OwnerList key={filter + sort} rows={rows} spot={d.spot} isMobile={isMobile}
        sheet={sheetN ? d.owners.find(o => o.n === sheetN) || null : null} onSheet={o => setSheetN(o?.n ?? null)} />

      <Section title="The collection">
        <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 22 : 40 }}>
          <Versus label="SPX (coins)" a={t.bought} b={t.soldAll} fmt={big} />
          <Versus label="US dollars at the time" a={t.boughtUsd} b={t.soldUsd} fmt={usd} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? "8px 18px" : "8px 34px", marginTop: 18 }}>
          {stat(pct(h.top10), "of what's held sits with the top 10")}
          {stat(d.sellersFor80pct, "owners did 80% of the selling")}
        </div>
        {d.cex && <ExchangeFlows c={d.cex} isMobile={isMobile} />}
      </Section>

      <Section title="Year by year">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...th, textAlign: "left" }}>Year</th>
            {isMobile ? <><th style={th}>Bought</th><th style={th}>Sold</th></>
              : <><th style={th}>Bought (SPX)</th><th style={th}>Bought ($)</th><th style={th}>Sold (SPX)</th><th style={th}>Sold ($)</th></>}
            <th style={th}>Net bought ($)</th>
          </tr></thead>
          <tbody>{years.map(([y, b]) => {
            const net = b.buyUsd - b.sellUsd;
            const two = (u, q) => <td style={td}>{usd(u)}<div style={{ fontSize: 12, color: DIM }}>{big(q)} SPX</div></td>;
            return (
              <tr key={y}>
                <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{y}{y === d.updated.slice(0, 4) ? "*" : ""}</td>
                {isMobile ? <>{two(b.buyUsd, b.buyQty)}{two(b.sellUsd, b.sellQty)}</>
                  : <><td style={td}>{big(b.buyQty)}</td><td style={td}>{usd(b.buyUsd)}</td><td style={td}>{big(b.sellQty)}</td><td style={td}>{usd(b.sellUsd)}</td></>}
                <td style={{ ...td, color: net >= 0 ? "#34d399" : "#fb7185", fontWeight: 700 }}>{(net >= 0 ? "+" : "−") + usd(Math.abs(net))}</td>
              </tr>
            );
          })}</tbody>
        </table>
        <div style={{ fontFamily: SANS, fontSize: 13, color: DIM, marginTop: 6 }}>* so far this year</div>
      </Section>

      <Section title="Held or sold">
        <div style={{ display: "flex", height: 22, width: "100%", marginBottom: 10 }}>
          {vCount.map(v => <div key={v.k} title={V[v.k].label} style={{ width: `${(v.households / totalHH) * 100}%`, background: V[v.k].color }} />)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? "8px 18px" : "8px 30px" }}>
          {vCount.map(v => (
            <div key={v.k} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: SANS, fontSize: 14, color: BODY }}>
              <Chip v={v.k} /><strong style={{ color: INK, fontFamily: MONO }}>{v.households}</strong>
            </div>
          ))}
        </div>
      </Section>

      <details style={{ marginTop: 34, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
        <summary style={{ cursor: "pointer", minHeight: 40, display: "flex", alignItems: "center", fontFamily: MONO, fontSize: 13, letterSpacing: "0.12em",
          textTransform: "uppercase", color: INK, fontWeight: 600 }}>How this is built</summary>
        <ul style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.7, color: BODY, margin: "8px 0 0", paddingLeft: 20, maxWidth: 820 }}>
          <li><strong style={{ color: INK }}>Owners, not wallets.</strong> Every AEON holder is grouped with the wallets it provably controls on SPX: one emptying into another, a fresh wallet funded and never spent from, several consolidating into one. Services that link to hundreds of wallets are cut, not merged.</li>
          <li><strong style={{ color: INK }}>Checked, not estimated.</strong> Each owner&apos;s SPX history is rebuilt trade by trade and counts only if it sums to the real balance ({s.reconciled} of {s.withSpx}). {s.neverTouchedSpx.toLocaleString()} AEON owners never held SPX on Ethereum.</li>
          <li><strong style={{ color: INK }}>Sold</strong> = trades through a DEX pool or router. <strong style={{ color: INK }}>Sent to exchanges</strong> = transfers into {d.cex ? `${d.cex.exchanges} tagged exchange wallets or ${d.cex.deposits.toLocaleString()} inferred deposit addresses` : "tagged exchange wallets"}, net of withdrawals: likely sold, not proven.</li>
          <li><strong style={{ color: INK }}>Verdicts:</strong> {ORDER.map(k => `${V[k].label}: ${V[k].def.replace(/\.$/, "")}`).join(" · ")}.</li>
          <li><strong style={{ color: INK }}>P&amp;L</strong> is SPX trading only, at average cost. Every buy and sell counts what actually changed hands in its transaction{d.pricing ? ` (${(d.pricing.wallet + d.pricing.pool).toLocaleString()} trades; ${d.pricing.close.toLocaleString()} unreadable ones at the day's close)` : ""}. SPX that goes out and comes back from the same place (collateral, a pool, an exchange) keeps its cost. SPX that arrived without a purchase (a bridge, another wallet, a gift) has no known cost, so it is counted but left out of the P&amp;L, never given a made-up price. Ethereum only. A snapshot as of {d.updated}; a picture never proves who owns a wallet.</li>
        </ul>
      </details>
    </div>
  );
}
