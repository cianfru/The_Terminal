// AEON Ledger — every AEON owner's SPX record, reconstructed from the chain and reconciled to it.
//
// The question the owner asked: across the whole collection, is the SPX being HELD or SOLD? Each owner is
// a "household": the AEON-holding wallet plus the wallets structurally linked to it (drains, vaults,
// consolidations — research/pfp-forensics/landscape/). Every household's ledger is summed and checked
// against its on-chain balance before it counts; one that does not reconcile is listed, never guessed.
//
// TWO LAYERS (owner decision 2026-09-23, the smart-money model): the numbers are public; the wallet
// ADDRESSES are for Deep Field members only. fetchPrivate() returns the members file (with `wallets`) to a
// logged-in member and the public file (no addresses, per-owner figures rounded) to everyone else.
//
// Built by landscape/export.mjs → public/aeon-ledger.json; refreshed by aeon-ledger.yml (dispatch).
import { useEffect, useMemo, useState } from "react";
import { fetchPrivate } from "./history-data.js";
import { SANS, MONO, MAX_W, Metric, Explain, ViewTabs } from "./chart-ui.jsx";
import OwnerList from "./AeonLedgerOwners.jsx";
import { OWNER_SORTS } from "./aeon-ledger-pos.js";
import { loadMe } from "./members.js";

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
  const [me, setMe] = useState(null);
  useEffect(() => { loadMe().then(setMe); }, []);
  useEffect(() => {
    let off = false;
    fetchPrivate("aeon-ledger", "/aeon-ledger.json", { publicSafe: true }).then(x => { if (!off) setD(x || { empty: true }); });
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
  const members = d.owners.some(o => Array.isArray(o.wallets));
  const years = Object.entries(d.years || {}).sort(([a], [b]) => a.localeCompare(b));
  const vCount = ORDER.map(k => ({ k, ...(d.byVerdict[k] || { households: 0, holds: 0 }) }));
  const totalHH = vCount.reduce((a, v) => a + v.households, 0) || 1;

  return (
    <div style={{ maxWidth: Math.min(MAX_W, 1100), margin: "0 auto" }}>
      <Explain q="Are AEON holders holding their SPX, or selling it?" accent="#2dd4bf">
        Every wallet that holds an AEON, grouped with the wallets it provably controls (drains, vaults, consolidations) into one{" "}
        <strong style={{ color: INK }}>owner</strong>. Each owner&apos;s full SPX history on Ethereum is rebuilt trade by trade and{" "}
        <strong style={{ color: INK }}>checked against its balance on the chain</strong> before it counts. {s.reconciled} of {s.withSpx} reconciled.
      </Explain>

      <div style={{ display: "flex", gap: isMobile ? 14 : 30, justifyContent: "center", flexWrap: "wrap", margin: "6px 0 4px" }}>
        <Metric label="owners with SPX" value={s.withSpx.toLocaleString()} color="#2dd4bf" sub={`of ${s.households.toLocaleString()} AEON owners`} />
        <Metric label="still hold SPX" value={h.owners.toLocaleString()} color="#38bdf8" sub={pct(h.owners / s.withSpx)} />
        <Metric label="SPX held today" value={big(t.holds)} color="#34d399" />
        <Metric label="exited" value={(d.byVerdict.exited?.households || 0).toLocaleString()} color="#fb7185" sub={pct((d.byVerdict.exited?.households || 0) / s.withSpx)} />
      </div>

      <Section title="Bought vs sold" sub="In coins, buying leads, because most coins came in during the launch months when tens of millions of SPX cost a few thousand dollars. In dollars, these owners have taken out more than they put in.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 22 : 40 }}>
          <Versus label="SPX (coins)" a={t.bought} b={t.soldAll} fmt={big} />
          <Versus label="US dollars at the time" a={t.boughtUsd} b={t.soldUsd} fmt={usd} />
        </div>
      </Section>

      <Section title="Year by year" sub="Who is selling now, not in 2023. Dollars are the SPX price on the day of each trade.">
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
                <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{y}{y === d.updated.slice(0, 4) ? (isMobile ? "*" : " (so far)") : ""}</td>
                {isMobile ? <>{two(b.buyUsd, b.buyQty)}{two(b.sellUsd, b.sellQty)}</>
                  : <><td style={td}>{big(b.buyQty)}</td><td style={td}>{usd(b.buyUsd)}</td><td style={td}>{big(b.sellQty)}</td><td style={td}>{usd(b.sellUsd)}</td></>}
                <td style={{ ...td, color: net >= 0 ? "#34d399" : "#fb7185", fontWeight: 700 }}>{(net >= 0 ? "+" : "−") + usd(Math.abs(net))}</td>
              </tr>
            );
          })}</tbody>
        </table>
        {isMobile && <div style={{ fontFamily: SANS, fontSize: 13, color: DIM, marginTop: 6 }}>* so far this year. Negative = more sold than bought.</div>}
      </Section>

      <Section title="Held or sold, owner by owner" sub={`Each of the ${s.withSpx} owners gets one verdict from what they did with their SPX.`}>
        <div style={{ display: "flex", height: 26, width: "100%", marginBottom: 12 }}>
          {vCount.map(v => <div key={v.k} title={V[v.k].label} style={{ width: `${(v.households / totalHH) * 100}%`, background: V[v.k].color }} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "10px 30px" }}>
          {vCount.map(v => (
            <div key={v.k} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "baseline" }}>
              <Chip v={v.k} />
              <div style={{ fontFamily: SANS, fontSize: 14, color: BODY, lineHeight: 1.5 }}>
                <strong style={{ color: INK, fontFamily: MONO }}>{v.households}</strong> owners · hold <strong style={{ color: INK, fontFamily: MONO }}>{big(v.holds)}</strong> SPX
                <div style={{ color: DIM, fontSize: 13 }}>{V[v.k].def}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Who holds, who sold" sub="A few owners hold most of what's left, and a few did most of the selling.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 16 : 36, fontFamily: SANS, fontSize: 15, color: BODY, lineHeight: 1.6 }}>
          <div>The top <strong style={{ color: INK }}>10</strong> owners hold <strong style={{ color: INK, fontFamily: MONO }}>{pct(h.top10)}</strong> of the SPX still held; the top <strong style={{ color: INK }}>50</strong> hold <strong style={{ color: INK, fontFamily: MONO }}>{pct(h.top50)}</strong>.</div>
          <div><strong style={{ color: INK, fontFamily: MONO }}>{d.sellersFor80pct}</strong> owners account for <strong style={{ color: INK }}>80%</strong> of all SPX sold.</div>
        </div>
      </Section>

      <Section title="Every owner" sub={members
        ? "Members view: tap an owner for every buy and sale on the SPX price, and the wallets behind it."
        : "Each owner's picture is the rarest AEON they hold; tap it for all their pieces. P&L is SPX trading only, at average cost; per-owner figures are rounded to three significant figures. Tap an owner for the full record."}>
        <ViewTabs tabs={[["all", "All"], ...ORDER.map(k => [k, V[k].label])]} value={filter} onChange={setFilter} />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "12px 0 16px", fontFamily: SANS, fontSize: 14, color: MUT }}>
          Sort by
          {OWNER_SORTS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSort(k)} aria-pressed={sort === k} style={{ minHeight: 40, padding: "0 12px", cursor: "pointer", fontFamily: SANS, fontSize: 14,
              background: sort === k ? "rgba(45,212,191,0.16)" : "transparent", color: INK, border: `1px solid ${sort === k ? "#2dd4bf" : LINE}` }}>{l}</button>
          ))}
        </div>
        <OwnerList key={filter + sort} rows={rows} me={me} spot={d.spot} isMobile={isMobile} />
      </Section>

      <Section title="How this is built, and what it can't tell you">
        <ul style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.7, color: BODY, margin: 0, paddingLeft: 20, maxWidth: 820 }}>
          <li><strong style={{ color: INK }}>Owners, not wallets.</strong> Wallets are grouped only by structural links on SPX itself: one wallet emptying into another, a fresh wallet funded and never spent from, several wallets consolidating into one. Shared gas funding is not used. A service that links to hundreds of wallets is flagged and cut, not merged.</li>
          <li><strong style={{ color: INK }}>Bought and sold</strong> mean trades through a DEX pool or router, including sales settled in another token (counted as sold). Plain transfers to other wallets are counted separately, never as trades.</li>
          <li><strong style={{ color: INK }}>Exchange sales look like transfers.</strong> Selling on an exchange means sending SPX to a deposit address, which on-chain is a transfer. So &quot;sold&quot; is a floor: these owners also sent {big(t.movedOut)} SPX out to other wallets, some of it to exchanges.</li>
          <li><strong style={{ color: INK }}>Ethereum only.</strong> SPX held on Base or Solana is not included.</li>
          <li><strong style={{ color: INK }}>Checked, not estimated.</strong> An owner counts only if its rebuilt ledger sums to its real balance. {s.excluded ? `${s.excluded} did not and are left out.` : "Every owner did."} {s.neverTouchedSpx.toLocaleString()} AEON owners never held SPX on Ethereum.</li>
          <li><strong style={{ color: INK }}>A snapshot.</strong> As of {d.updated}. A verdict describes what an owner did, not who they are, and a profile picture never proves who owns a wallet.</li>
        </ul>
      </Section>
    </div>
  );
}
