// The PFP forensics case file (?view=cases) — MEMBERS ONLY.
//
// ⚠⚠ INTERNAL SINCE 2026-09-23, AT A SUBJECT'S REQUEST. A wallet we tracked asked not to
// be followed. The watcher was disarmed and this page moved behind the members key rather
// than deleted: the work is kept, the broadcasting is not. Do not un-gate it without a
// reason better than wanting the reach.
//
// A post is one picture and one number, and a reader has no way to check either. That is
// the failure mode the project exists to avoid: the moment a claim stops being
// reproducible we are just another account with an opinion. So every case we publish
// lands here with the wallet addresses that produced it, linked to Etherscan, next to the
// caveats that bound what those numbers can mean.
//
// The addresses were already public — cases.json lives in a public repo — so this is not
// new disclosure. It makes existing disclosure usable, which is the whole point.
//
// ⚠ X HANDLES ARE NOT STORED AND MUST NEVER BE ADDED. A profile picture does not prove
// who owns a wallet. Cases are keyed by token id and address, both public chain data;
// naming an account would convert a lead into an accusation.
//
// Styling follows DocsPage/MethodsPage: one column, rules instead of boxes, no pills or
// gradients. Numbers are mono, copy is sans, and everything a reader has to READ clears
// 14px — this page is nothing but readable detail.
import { useMemo, useState, useEffect } from "react";
import REG from "../research/pfp-forensics/cases.json";
import { SANS, MONO } from "./chart-ui.jsx";
import { TERMINAL_KEY, isValidAccess } from "./terminal-gate-key.js";
import { CITY_KEY } from "./city-gate-key.js";

const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** The same members key that opens Deep Field. One key, one members area. */
function Gate({ onPass }) {
  const [pw, setPw] = useState(""), [bad, setBad] = useState("");
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "80px 20px", fontFamily: SANS }}>
      <h1 style={{ fontSize: 26, color: TEXT, fontWeight: 700, margin: "0 0 10px" }}>Members only</h1>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: BODY, margin: "0 0 18px" }}>
        The profile-picture case file is internal. It was public; a wallet we had been tracking
        asked not to be followed, so the watcher was switched off and this moved behind the
        members key. The research is kept, it is simply no longer broadcast.
      </p>
      <form onSubmit={e => { e.preventDefault();
        if (isValidAccess(fnv(pw.trim().toLowerCase()))) {
          try { localStorage.setItem(TERMINAL_KEY, "1"); localStorage.setItem(CITY_KEY, "1"); } catch { /* private mode */ }
          onPass();
        } else setBad("Not that one.");
      }}>
        <input type="password" value={pw} autoFocus onChange={e => { setPw(e.target.value); setBad(""); }}
          placeholder="members key"
          style={{ width: "100%", padding: "12px 14px", fontFamily: MONO, fontSize: 15, color: TEXT,
                   background: "rgba(255,255,255,0.04)", border: `1px solid ${HEADRULE}`, borderRadius: 8, minHeight: 44 }} />
        {bad && <div style={{ color: WARN, fontSize: 14, marginTop: 8 }}>{bad}</div>}
      </form>
    </div>
  );
}

const DIM = "#7c8a9e", BODY = "#9aa7bb", NEAR = "#cbd5e1", TEXT = "#f1f5f9";
const RULE = "#1c1c21", HEADRULE = "#2a2a31", ACCENT = "#5eead4", WARN = "#fbbf24";

const ES = a => `https://etherscan.io/address/${a}`;
const short = a => `${a.slice(0, 10)}…${a.slice(-6)}`;
const f = n => (n == null ? "—" : Math.round(n).toLocaleString());
const usd = n => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);

/** One side of the trade, stated from whatever the registry actually carries.
 *  ⚠ The first version headlined qty unconditionally, and two cases have never stored one —
 *  they rendered as a bare em-dash above "SPX for $14,952", which reads as missing data on a
 *  page whose entire job is to look checkable. Whichever figure exists leads. */
function side(label, t) {
  if (!t || (t.qty == null && t.usd == null)) return { k: label, v: "—", sub: "not recorded" };
  const n = t.n != null ? `${t.n} trade${t.n === 1 ? "" : "s"}` : null;
  if (t.qty != null)
    return { k: label, v: f(t.qty), sub: [t.usd != null ? `SPX for ${usd(t.usd)}` : "SPX", n].filter(Boolean).join(" · ") };
  return { k: label, v: usd(t.usd), sub: n || "" };
}

/** A labelled figure. Kept as a row of text, not a card — a grid of tiles is the look we
 *  deliberately do not use here. */
function Fig({ k, v, sub }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: SANS, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: DIM, fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: MONO, fontSize: 21, color: TEXT, fontWeight: 700, margin: "3px 0 1px", wordBreak: "break-word" }}>{v}</div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 13, color: BODY }}>{sub}</div>}
    </div>
  );
}

function Note({ children, warn }) {
  return (
    <p style={{
      fontFamily: SANS, fontSize: 14, lineHeight: 1.65, color: BODY, margin: "0 0 12px",
      borderLeft: `2px solid ${warn ? WARN : HEADRULE}`, paddingLeft: 12,
    }}>{children}</p>
  );
}

function Wallets({ title, list, note }) {
  if (!list?.length) return null;
  return (
    <div style={{ margin: "22px 0 0" }}>
      <div style={{ fontFamily: SANS, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: DIM, fontWeight: 600, marginBottom: 8 }}>
        {title} · {list.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {list.map(a => (
          <a key={a} href={ES(a)} target="_blank" rel="noopener noreferrer"
             style={{
               fontFamily: MONO, fontSize: 13.5, color: NEAR, textDecoration: "none",
               padding: "11px 0", borderBottom: `1px solid ${RULE}`, display: "flex",
               alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 42,
             }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a}</span>
            <span style={{ color: ACCENT, fontSize: 12.5, flexShrink: 0 }}>etherscan ↗</span>
          </a>
        ))}
      </div>
      {note && <p style={{ fontFamily: SANS, fontSize: 13.5, lineHeight: 1.6, color: DIM, margin: "10px 0 0" }}>{note}</p>}
    </div>
  );
}

function Case({ c, isMobile }) {
  const [open, setOpen] = useState(false);
  const t = c.clusterTrades || {};
  const bought = t.buys || {}, sold = t.sells || {};
  return (
    <section style={{ borderTop: `1px solid ${HEADRULE}`, paddingTop: 26, margin: "46px 0 0" }}>
      <div style={{ fontFamily: SANS, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: DIM, fontWeight: 600, marginBottom: 6 }}>
        {c.study ? `Case study #${c.study}` : "Traced, not published"}{c.status === "queued" ? " · not posted yet" : ""}
      </div>
      <h2 style={{ fontFamily: SANS, fontSize: isMobile ? 22 : 26, color: TEXT, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
        AEON #{c.token}
      </h2>
      <div style={{ fontFamily: SANS, fontSize: 14.5, color: ACCENT, marginBottom: 14 }}>{c.archetype}</div>
      <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.68, color: BODY, margin: "0 0 20px" }}>{c.verdict}</p>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", margin: "0 0 20px" }}>
        <Fig {...side("Bought", bought)} />
        <Fig {...side("Sold", sold)} />
        <Fig k="Holds now" v={f(c.holdsNow)} sub="SPX across the core" />
        <Fig k="Bubble buying" v={bought.pctUsdBubblePlus != null ? `${bought.pctUsdBubblePlus}%` : "—"} sub="of dollars spent" />
      </div>

      <Note>{c.clusterNote}</Note>
      {c.holdsNowNote && <Note warn={/CORRECT|⚠/.test(c.holdsNowNote)}>{c.holdsNowNote}</Note>}
      {t.note && <Note warn>{t.note}</Note>}
      {t.correction && <Note warn>{t.correction}</Note>}

      <Wallets title="Wallets in the core" list={c.wallets} />
      <Wallets title="Wallets holding the NFT" list={c.nftCustody} note={c.nftCustodyNote} />

      {c.secondHop && (
        <div style={{ margin: "22px 0 0" }}>
          <div style={{ fontFamily: SANS, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: DIM, fontWeight: 600, marginBottom: 8 }}>
            Where the moved coins went
          </div>
          <Note>{c.secondHop.finding}</Note>
          <Note warn>{c.secondHop.caveat}</Note>
        </div>
      )}

      {!!c.charts?.length && (
        <div style={{ margin: "22px 0 0" }}>
          <button onClick={() => setOpen(v => !v)}
            style={{
              fontFamily: SANS, fontSize: 14, color: ACCENT, background: "none",
              border: `1px solid ${HEADRULE}`, borderRadius: 8, padding: "11px 14px",
              cursor: "pointer", minHeight: 42,
            }}>
            {open ? "Hide" : "Show"} the {c.charts.length} charts behind this case
          </button>
          {open && c.charts.map(src => (
            <img key={src} src={`/cases/${src}`} alt={`AEON #${c.token} — ${src}`} loading="lazy"
                 style={{ display: "block", width: "100%", height: "auto", borderRadius: 10, border: `1px solid ${RULE}`, margin: "16px 0 0" }} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function CasesPage({ isMobile }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { try { setOpen(localStorage.getItem(TERMINAL_KEY) === "1"); } catch { /* private mode */ } }, []);
  if (!open) return <Gate onPass={() => setOpen(true)} />;
  return <CaseFile isMobile={isMobile} />;
}

function CaseFile({ isMobile }) {
  // ⚠ ORDER BY PUBLISHING ORDER, NOT TOKEN ID. Sorting by token put #14 last — the newest
  // study, whose own card reads "Case study #3" — beneath the oldest case, so a reader
  // arriving from that post scrolled past three older ones to reach it.
  const cases = useMemo(
    () => REG.cases.slice().sort((a, b) =>
      (b.study ?? -1) - (a.study ?? -1) || b.token - a.token), []);
  const wallets = useMemo(
    () => new Set(cases.flatMap(c => [...(c.wallets || []), ...(c.nftCustody || [])].map(a => a.toLowerCase()))).size,
    [cases]);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: isMobile ? "26px 16px 90px" : "40px 24px 120px" }}>
      <h1 style={{ fontFamily: SANS, fontSize: isMobile ? 27 : 34, color: TEXT, fontWeight: 700, margin: "0 0 10px", letterSpacing: "-0.015em" }}>
        The case file
      </h1>
      <p style={{ fontFamily: SANS, fontSize: 15.5, lineHeight: 1.7, color: BODY, margin: "0 0 14px" }}>
        {cases.length} cases, {wallets} addresses, all linked to Etherscan. Internal since
        2026-09-23: a wallet we tracked asked not to be followed, so the watcher was disarmed
        and this file moved behind the members key. Treat what is here as working notes, not
        as something to circulate.
      </p>
      <p style={{ fontFamily: SANS, fontSize: 15.5, lineHeight: 1.7, color: BODY, margin: "0 0 14px" }}>
        The method runs in one direction: chain first. A picture points at a wallet; the wallet's
        own transfers decide what is true. Wallets are linked into a household only by structure —
        one emptying into another, several gathering into a fresh one, or a wallet that received
        coins and has never spent them. Never by a partial payment between two live wallets, and
        never through an exchange or a pool.
      </p>

      <div style={{ borderTop: `1px solid ${HEADRULE}`, margin: "24px 0 0", paddingTop: 18 }}>
        <div style={{ fontFamily: SANS, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: DIM, fontWeight: 600, marginBottom: 10 }}>
          What these numbers cannot tell you
        </div>
        <Note warn>
          A profile picture never proves who owns a wallet. It is a lead, not an identity — which is
          why no account name is recorded here, only token ids and addresses.
        </Note>
        <Note warn>
          Coins that left a household cannot be followed. A token is fungible, so once it lands in a
          wallet holding its own, no on-chain fact says which coins later moved. Downstream is
          reported as a count of wallets, never as a sum of tokens.
        </Note>
        <Note>
          Figures are cluster-scope and recomputed from the chain, not typed in. Band labels come
          from the rainbow model, which is frozen and never re-fitted to flatter a result. Prices use
          the value crossing the pool at that transaction, so they reflect what was actually paid or
          received rather than that day's close.
        </Note>
      </div>

      {cases.map(c => <Case key={c.token} c={c} isMobile={isMobile} />)}

      <p style={{ fontFamily: SANS, fontSize: 13.5, lineHeight: 1.65, color: DIM, margin: "44px 0 0", borderTop: `1px solid ${RULE}`, paddingTop: 16 }}>
        Registry last recomputed {REG.updated}. Prices as of {REG.priceAsOf?.date} at $
        {REG.priceAsOf?.spot}. Band measure: {REG.bandMeasure}
      </p>
    </div>
  );
}
