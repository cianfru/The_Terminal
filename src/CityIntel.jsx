import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { loadCityHistory, loadWhales, loadOnchain } from "./history-data.js";
import { SANS, MONO, MAX_W, Metric, Explain, ViewTabs } from "./chart-ui.jsx";
import { cityIntel, cityMovement } from "./city-intel.js";

// SPX CITY — INTEL. The whole dossier on one page: who lives in the city, what it is worth, who is
// arriving and leaving, which size tiers are moving right now, and how much of each arrival cohort
// is still here. Everything already existed as separate series; this is the desk that reads them
// together.
//
// Population / value / growth / arrivals / vintages come from city-history.json, so this page and
// the City Growth chart can never disagree. Movement comes from whales.json and reports flow only —
// see the note in city-intel.js for why the two must not be mixed under one word.

const fUsd = v => (v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(0) + "k" : "$" + Math.round(v));
const fNum = v => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + "k" : String(Math.round(v)));
const fSpx = v => fNum(v) + " SPX";
// Wallet counts are read as counts, not magnitudes — "4,887 citizens" tells you something that
// "4.9k" doesn't. fNum's k/M abbreviation stays for token amounts and dollars.
const fCount = v => Math.round(v).toLocaleString("en-US");
const fDate = t => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
// the flow chart spans months, not years — a month+year tick repeats itself three times over
const fDay = t => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const sign = v => (v > 0 ? "+" : v < 0 ? "−" : "");
const UP = "#4ade80", DOWN = "#fb7185", DIM = "#8b98ad";

const Delta = ({ d, pct, fmt = fNum }) => (
  <span style={{ color: d > 0 ? UP : d < 0 ? DOWN : DIM }}>
    {sign(d)}{fmt(Math.abs(d))}{pct != null && ` (${sign(d)}${Math.abs(pct).toFixed(1)}%)`}
  </span>
);

function Section({ title, note, children }) {
  return (
    <section style={{ margin: "30px 0 0" }}>
      <h3 style={{ fontFamily: MONO, fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--tx)", margin: "0 0 4px" }}>{title}</h3>
      {note && <p style={{ fontFamily: SANS, fontSize: 14, color: "var(--dim)", margin: "0 0 12px", lineHeight: 1.55 }}>{note}</p>}
      {children}
    </section>
  );
}

// tables scroll sideways rather than squeezing on a phone — the project's mobile rule
const Scroller = ({ children }) => <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>{children}</div>;
const th = { fontFamily: MONO, fontSize: 12.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--dim)", textAlign: "right", padding: "8px 12px", borderBottom: "1px solid var(--line2)", whiteSpace: "nowrap" };
const td = { fontFamily: MONO, fontSize: 14, color: "var(--tx)", textAlign: "right", padding: "9px 12px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };

export default function CityIntel({ isMobile, preview = false }) {
  const [hist, setHist] = useState(null);
  const [whales, setWhales] = useState(null);
  const [circ, setCirc] = useState(0);
  const [win, setWin] = useState("d30");

  useEffect(() => {
    let off = false;
    loadCityHistory().then(d => { if (!off) setHist(d || false); });
    loadWhales().then(d => { if (!off) setWhales(d || false); });
    loadOnchain().then(rows => { const r = rows?.at?.(-1); if (!off && r) setCirc(1e9 - (r.burnBal || 0)); });
    return () => { off = true; };
  }, []);

  const ci = useMemo(() => (hist ? cityIntel(hist, { circulating: circ }) : null), [hist, circ]);
  const mv = useMemo(() => (whales ? cityMovement(whales, { window: win }) : null), [whales, win]);

  if (hist === false) return <div style={{ padding: 60, textAlign: "center", fontFamily: SANS, color: "var(--dim)" }}>City data is being rebuilt — the intel page returns after the next on-chain refresh.</div>;
  if (!ci) return <div style={{ padding: 60, textAlign: "center", fontFamily: MONO, color: "var(--faint)" }}>…</div>;

  const growth = ci.series.filter((_, i) => i % (isMobile ? 7 : 3) === 0 || i === ci.series.length - 1);
  const flow30 = ci.flow.slice(-(isMobile ? 60 : 120));

  return (
    <div style={{ maxWidth: MAX_W, margin: "0 auto", fontFamily: SANS }}>
      <Explain q="What is SPX City, and what is this page?">
        The city is every wallet holding at least 5,000 SPX for 90 days or more — {fCount(ci.citizens)} of them, holding{" "}
        {fSpx(ci.tokens)} between them, {ci.shareOfCirculating ? `${ci.shareOfCirculating.toFixed(0)}% of every coin that can trade` : "a large share of supply"}.
        This page reads every series we keep on it at once: who lives there, what it is worth, who arrived and left,
        which size tiers are moving, and how much of each arrival cohort is still standing.
      </Explain>

      {/* ── the headline reads ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? 148 : 186}px, 1fr))`, gap: 12, margin: "18px 0 0" }}>
        <Metric label="Citizens" value={fCount(ci.citizens)} color="#7dd3fc" sub={<>30d <Delta d={ci.citizens30.d} pct={ci.citizens30.pct} fmt={fCount} /></>} />
        <Metric label="City value" value={fUsd(ci.tvl)} color="#4ade80" sub={<>30d <Delta d={ci.tvl30.d} pct={ci.tvl30.pct} fmt={fUsd} /></>} />
        <Metric label="Held by the city" value={fSpx(ci.tokens)} color="#a3e635" sub={ci.shareOfCirculating ? `${ci.shareOfCirculating.toFixed(1)}% of circulating` : "—"} />
        <Metric label="Median citizen" value={fSpx(ci.medianHolding || 0)} color="#fbbf24" sub="the middle resident's bag" />
        <Metric label="Arrived · 30d" value={fCount(ci.arrived)} color={UP} sub={`${fCount(ci.left)} left`} />
        <Metric label="Net 30d" value={`${sign(ci.netArrivals)}${fCount(Math.abs(ci.netArrivals))}`} color={ci.netArrivals >= 0 ? UP : DOWN} sub="citizens, in minus out" />
      </div>

      {/* ── population and value by tier ───────────────────────────────────── */}
      <Section title="Who lives here" note="Every citizen by the size of their bag. The city is overwhelmingly small wallets by headcount and overwhelmingly large ones by value — the two columns disagree on purpose.">
        <Scroller>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "left" }}>tier</th><th style={th}>citizens</th><th style={th}>share</th>
              <th style={th}>value</th><th style={th}>share</th><th style={th}>Δ 30d</th>
            </tr></thead>
            <tbody>
              {ci.tiers.map(t => (
                <tr key={t.label}>
                  <td style={{ ...td, textAlign: "left" }}>
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: t.color, marginRight: 9 }} />{t.label}
                  </td>
                  <td style={td}>{fCount(t.n)}</td>
                  <td style={{ ...td, color: "var(--dim)" }}>{t.shareN.toFixed(1)}%</td>
                  <td style={td}>{fUsd(t.tvl)}</td>
                  <td style={{ ...td, color: "var(--dim)" }}>
                    <span style={{ display: "inline-block", width: 52, height: 6, background: "var(--line2)", borderRadius: 3, marginRight: 8, verticalAlign: "middle" }}>
                      <span style={{ display: "block", width: `${Math.max(2, t.shareTvl)}%`, height: 6, background: t.color, borderRadius: 3 }} />
                    </span>{t.shareTvl.toFixed(1)}%
                  </td>
                  <td style={td}><Delta d={t.dN30} fmt={fCount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroller>
      </Section>

      {/* ── growth ─────────────────────────────────────────────────────────── */}
      <Section title="How it grew" note="Citizens and the city's dollar value since launch. The population kept climbing through the drawdown; the value follows the price.">
        <div style={{ height: isMobile ? 260 : 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={growth} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={fDate}
                tick={{ fill: "var(--dim)", fontSize: 12, fontFamily: MONO }} stroke="var(--line2)" minTickGap={isMobile ? 48 : 70} />
              <YAxis yAxisId="n" tickFormatter={fNum} tick={{ fill: "var(--dim)", fontSize: 12, fontFamily: MONO }} stroke="var(--line2)" width={54} />
              <YAxis yAxisId="v" orientation="right" tickFormatter={fUsd} tick={{ fill: "var(--dim)", fontSize: 12, fontFamily: MONO }} stroke="var(--line2)" width={62} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line2)", borderRadius: 8, fontFamily: MONO, fontSize: 13 }}
                labelFormatter={t => new Date(t).toLocaleDateString("en-US", { dateStyle: "medium" })}
                formatter={(v, k) => [k === "tvl" ? fUsd(v) : fNum(v), k === "tvl" ? "city value" : "citizens"]} />
              <Area yAxisId="v" dataKey="tvl" stroke="#4ade80" fill="#4ade80" fillOpacity={0.12} strokeWidth={2} dot={false} />
              <Line yAxisId="n" dataKey="citizens" stroke="#7dd3fc" strokeWidth={2.4} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* ── arrivals vs departures ─────────────────────────────────────────── */}
      <Section title="Arrivals and departures" note="Every day, how many wallets crossed into residency and how many dropped out. The count only moves when one side wins.">
        <div style={{ height: isMobile ? 200 : 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={flow30} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} stackOffset="sign">
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={fDay}
                tick={{ fill: "var(--dim)", fontSize: 12, fontFamily: MONO }} stroke="var(--line2)" minTickGap={isMobile ? 56 : 84} />
              <YAxis tickFormatter={v => sign(v) + Math.abs(v)} tick={{ fill: "var(--dim)", fontSize: 12, fontFamily: MONO }} stroke="var(--line2)" width={44} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line2)", borderRadius: 8, fontFamily: MONO, fontSize: 13 }}
                labelFormatter={t => new Date(t).toLocaleDateString("en-US", { dateStyle: "medium" })}
                formatter={(v, k) => [Math.abs(v), k === "in" ? "arrived" : "left"]} />
              <ReferenceLine y={0} stroke="var(--line2)" />
              <Bar dataKey="in" stackId="f" fill={UP} />
              <Bar dataKey="out" stackId="f" fill={DOWN} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* ── movement ───────────────────────────────────────────────────────── */}
      <Section title="Who is moving" note={mv ? `Net flow per size tier over the window, from per-wallet balances. A wallet counts as buying or selling only if it moved more than 0.5% of its bag (minimum 1,000 SPX) — anything smaller is dust. ${fCount(mv.flat)} of ${fCount(mv.tracked)} tracked wallets did not move at all.` : "Loading…"}>
        <ViewTabs tabs={[["d1", "24 hours"], ["d7", "7 days"], ["d30", "30 days"]]} value={win} onChange={setWin} />
        {mv && (
          <Scroller>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560, marginTop: 10 }}>
              <thead><tr>
                <th style={{ ...th, textAlign: "left" }}>tier</th><th style={th}>buying</th><th style={th}>selling</th>
                <th style={th}>flat</th><th style={th}>net</th><th style={th}>net % of tier</th>
              </tr></thead>
              <tbody>
                {mv.tiers.map(t => (
                  <tr key={t.label}>
                    <td style={{ ...td, textAlign: "left" }}>{t.label}</td>
                    <td style={{ ...td, color: t.buy ? UP : DIM }}>{t.buy}</td>
                    <td style={{ ...td, color: t.sell ? DOWN : DIM }}>{t.sell}</td>
                    <td style={{ ...td, color: "var(--dim)" }}>{t.flat}</td>
                    <td style={td}><Delta d={t.net} fmt={fSpx} /></td>
                    <td style={{ ...td, color: t.netPct > 0 ? UP : t.netPct < 0 ? DOWN : DIM }}>{sign(t.netPct)}{Math.abs(t.netPct).toFixed(2)}%</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...td, textAlign: "left", color: "var(--dim)" }}>whole city</td>
                  <td style={{ ...td, color: UP }}>{mv.buy}</td>
                  <td style={{ ...td, color: DOWN }}>{mv.sell}</td>
                  <td style={{ ...td, color: "var(--dim)" }}>{fCount(mv.flat)}</td>
                  <td style={td}><Delta d={mv.net} fmt={fSpx} /></td>
                  <td style={{ ...td, color: mv.netPct > 0 ? UP : mv.netPct < 0 ? DOWN : DIM }}>{sign(mv.netPct)}{Math.abs(mv.netPct).toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </Scroller>
        )}
      </Section>

      {/* ── vintages ───────────────────────────────────────────────────────── */}
      <Section title="Where the citizens came from" note="Each arrival cohort and how much of it is still resident. Recent cohorts read high because they have had less time to leave — that is survivorship, not conviction.">
        <Scroller>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480 }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "left" }}>arrived</th><th style={th}>wallets</th><th style={th}>still here</th><th style={{ ...th, textAlign: "left" }}>survival</th>
            </tr></thead>
            <tbody>
              {ci.vintages.map(v => (
                <tr key={v.label}>
                  <td style={{ ...td, textAlign: "left" }}>{v.label}</td>
                  <td style={td}>{fCount(v.arrived)}</td>
                  <td style={td}>{fCount(v.stillHere)}</td>
                  <td style={{ ...td, textAlign: "left", width: "46%" }}>
                    <span style={{ display: "inline-block", width: "70%", maxWidth: 220, height: 8, background: "var(--line2)", borderRadius: 4, marginRight: 10, verticalAlign: "middle" }}>
                      <span style={{ display: "block", width: `${Math.max(1, v.pct)}%`, height: 8, background: "#7dd3fc", borderRadius: 4 }} />
                    </span>
                    <span style={{ color: "var(--dim)" }}>{v.pct.toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroller>
      </Section>

      <p style={{ fontSize: 13, color: "var(--dim)", lineHeight: 1.6, margin: "26px 2px 0" }}>
        Residency is 5,000 SPX held for 90 days, ETH-native, reconstructed from on-chain FIFO lots — exchanges, LP pools
        and the bridge are not citizens and are not counted here. Population, value, arrivals and vintages come from the
        city's own daily replay ({ci.updated}); the movement table reads per-wallet flow from the whale snapshot
        {mv ? ` (${mv.updated})` : ""}, which counts holding age per lot and so differs from the replay by a percent or
        two. A description of who holds the token, not a signal.
      </p>
    </div>
  );
}
