// Find an AEON — "which piece is this picture?" without asking anyone (owner, 2026-09-23).
//
// The lesson from tools/nft-id: in a trait-generated collection, matching pixels is weak and READING THE
// TRAITS is decisive. Every trait is published metadata, so naming a few features you can see narrows 3,333
// pieces multiplicatively — Space-Buns hair (75) → Cross face marks (9) → Sunset background (1) = #2904.
// So this page is a faceted trait picker: each dropdown lists only the values still possible, with counts,
// and the matching pieces show underneath. Or type a token number. Tapping a piece shows its traits, its
// rarity and who holds it — linked to that owner's record in the AEON Ledger when they hold SPX.
//
// All client-side from public files (aeon-rarity.json + aeon-ledger.json). A profile picture is a lead,
// never proof of who owns a wallet — the page says so.
import { useEffect, useMemo, useRef, useState } from "react";
import { loadAeonRarity } from "./history-data.js";
import { SANS, MONO } from "./chart-ui.jsx";
import { aeonThumb, openseaUrl } from "./aeon-ledger-pos.js";

const INK = "var(--ch-ink,#fff)", MUT = "var(--ch-mut,#d0d9e6)", DIM = "var(--ch-dim,#b1bccc)";
const LINE = "rgba(148,163,184,0.28)", ACC = "#2dd4bf";
const PER = 48;

const CSS = `
.af-sel{width:100%;min-height:44px;padding:0 10px;background:var(--bg,#08090b);color:var(--ch-ink,#fff);border:1px solid ${LINE};font:500 15px ${SANS}}
.af-sel.on{border-color:${ACC};box-shadow:0 0 0 1px ${ACC}}
.af-sel:focus-visible,.af-t:focus-visible,.af-btn:focus-visible,.af-in:focus-visible{outline:2px solid ${ACC};outline-offset:2px}
.af-in{width:100%;min-height:44px;padding:0 12px;background:var(--bg,#08090b);color:var(--ch-ink,#fff);border:1px solid ${LINE};font:500 16px ${MONO}}
.af-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}
.af-t{padding:0;border:1px solid ${LINE};background:none;cursor:pointer;text-align:left}
.af-t[aria-pressed="true"]{border-color:${ACC};box-shadow:0 0 0 1px ${ACC}}
.af-t img,.af-t .ph{display:block;width:100%;aspect-ratio:1;object-fit:cover;background:#05050e}
.af-t span{display:block;padding:5px 7px;font:600 13px ${MONO};color:var(--ch-ink,#fff)}
.af-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border:1px solid ${LINE};
  background:transparent;color:var(--ch-ink,#fff);font:600 14px ${SANS};text-decoration:none;cursor:pointer}
.af-btn.acc{border-color:${ACC};color:${ACC}}
`;

const has = (t, k, v) => t.traits.some(x => x.t === k && x.v === v);

function Detail({ tok, owner, total, isMobile }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [tok.id]);
  return (
    <div ref={ref} style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 16 : 26, border: `1px solid ${ACC}`, padding: isMobile ? 14 : 20, margin: "4px 0 22px" }}>
      <a href={openseaUrl(tok.id)} target="_blank" rel="noopener noreferrer" style={{ flex: "0 1 300px", minWidth: 0 }} aria-label={`AEON #${tok.id} on OpenSea`}>
        <img src={tok.img} alt={`AEON #${tok.id}`} style={{ display: "block", width: "100%", aspectRatio: 1, objectFit: "cover", background: "#05050e" }} />
      </a>
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div style={{ font: `700 30px/1.1 ${SANS}`, color: INK }}>AEON #{tok.id}</div>
        <div style={{ font: `400 15px ${SANS}`, color: MUT, marginTop: 4 }}>Rarity rank <strong style={{ color: INK, fontFamily: MONO }}>{tok.rank}</strong> of {total.toLocaleString()}</div>
        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", margin: "14px 0 0" }}>
          {tok.traits.map((t, i) => <div key={t.t + i} style={{ display: "contents" }}>
            <dt style={{ font: `600 12px/1.8 ${MONO}`, letterSpacing: ".06em", textTransform: "uppercase", color: MUT }}>{t.t}</dt>
            <dd style={{ margin: 0, font: `400 15px/1.7 ${SANS}`, color: INK }}>{t.v}</dd>
          </div>)}
        </dl>
        <div style={{ font: `400 15px/1.55 ${SANS}`, color: INK, marginTop: 16 }}>
          {owner
            ? <>Held by <strong>Owner #{owner.n}</strong> in the AEON Ledger · {owner.aeon} AEON · {owner.walletCount} wallet{owner.walletCount === 1 ? "" : "s"}</>
            : <span style={{ color: MUT }}>Its holder has no SPX on Ethereum, so it is not in the AEON Ledger.</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          {owner && <a className="af-btn acc" href={`/?chart=aeonledger&owner=${owner.n}`}>Open Owner #{owner.n} →</a>}
          <a className="af-btn" href={openseaUrl(tok.id)} target="_blank" rel="noopener noreferrer">OpenSea ↗</a>
        </div>
      </div>
    </div>
  );
}

export default function AeonFinder({ isMobile }) {
  const [rar, setRar] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [picks, setPicks] = useState({});
  const [num, setNum] = useState("");
  const [sel, setSel] = useState(null);
  const [shown, setShown] = useState(PER);

  useEffect(() => {
    let off = false;
    loadAeonRarity().then(d => { if (!off) setRar(d || { tokens: [] }); });
    fetch("/aeon-ledger.json", { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null).then(d => { if (!off) setLedger(d); });
    return () => { off = true; };
  }, []);

  const tokens = useMemo(() => [...(rar?.tokens || [])].sort((a, b) => a.rank - b.rank), [rar]);
  const byId = useMemo(() => new Map(tokens.map(t => [t.id, t])), [tokens]);
  const ownerOf = useMemo(() => {
    const m = new Map();
    for (const o of ledger?.owners || []) for (const [id] of o.pieces || []) m.set(id, o);
    return m;
  }, [ledger]);
  const types = rar?.traitTypes || [];
  const pool = useMemo(() => tokens.filter(t => Object.entries(picks).every(([k, v]) => has(t, k, v))), [tokens, picks]);
  const facets = useMemo(() => {
    const f = {};
    for (const t of pool) for (const k of new Set(t.traits.map(x => `${x.t}\u0000${x.v}`))) {
      const [tt, v] = k.split("\u0000");
      (f[tt] ||= new Map()).set(v, (f[tt].get(v) || 0) + 1);
    }
    return Object.fromEntries(Object.entries(f).map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))]));
  }, [pool]);

  if (!rar) return <div style={{ textAlign: "center", fontFamily: SANS, color: MUT, padding: 60 }}>Loading 3,333 pieces…</div>;

  const pick = (k, v) => { setPicks(p => { const n = { ...p }; if (v) n[k] = v; else delete n[k]; return n; }); setShown(PER); setSel(null); };
  const lookup = e => { e.preventDefault(); const id = Number(String(num).replace(/\D/g, "")); if (byId.has(id)) setSel(id); };
  const active = Object.keys(picks).length;
  const selected = sel != null ? byId.get(sel) : pool.length === 1 && active ? pool[0] : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <style>{CSS}</style>

      <form onSubmit={lookup} style={{ display: "flex", gap: 10, maxWidth: 420, marginBottom: 16 }}>
        <input className="af-in" inputMode="numeric" placeholder="Or a token number, e.g. 2904" value={num} onChange={e => setNum(e.target.value)} aria-label="Token number" />
        <button type="submit" className="af-btn">Go</button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {types.filter(k => facets[k]?.length || picks[k]).map(k => (
          <label key={k} style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span style={{ font: `600 12px ${MONO}`, letterSpacing: ".08em", textTransform: "uppercase", color: MUT }}>{k}</span>
            <select className={"af-sel" + (picks[k] ? " on" : "")} value={picks[k] || ""} onChange={e => pick(k, e.target.value)}>
              <option value="">Any</option>
              {(facets[k] || []).map(([v, c]) => <option key={v} value={v}>{v} · {c}</option>)}
            </select>
          </label>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, margin: "16px 0 12px" }}>
        <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: pool.length === 1 && active ? ACC : INK }}>{pool.length.toLocaleString()}</span>
        <span style={{ fontFamily: SANS, fontSize: 15, color: MUT }}>{pool.length === 1 ? "piece matches" : "pieces match"}{active ? "" : " · pick a trait to narrow"}</span>
        {active > 0 && <button type="button" className="af-btn" onClick={() => { setPicks({}); setSel(null); setShown(PER); }}>Clear</button>}
      </div>

      {selected && <Detail tok={selected} owner={ownerOf.get(selected.id)} total={tokens.length} isMobile={isMobile} />}

      <div className="af-grid">
        {pool.slice(0, shown).map(t => (
          <button key={t.id} type="button" className="af-t" aria-pressed={selected?.id === t.id} onClick={() => setSel(t.id)} aria-label={`AEON #${t.id}`}>
            {t.img ? <img src={aeonThumb(t.img)} alt="" loading="lazy" decoding="async" onError={e => { if (e.currentTarget.src !== t.img) e.currentTarget.src = t.img; }} /> : <div className="ph" />}
            <span>#{t.id}</span>
          </button>
        ))}
      </div>
      {shown < pool.length && (
        <button type="button" className="af-btn" style={{ marginTop: 14, width: isMobile ? "100%" : "auto" }} onClick={() => setShown(shown + PER * 2)}>
          Show more ({(pool.length - shown).toLocaleString()} left)
        </button>
      )}
      <p style={{ fontFamily: SANS, fontSize: 14, color: DIM, marginTop: 22, maxWidth: 720 }}>
        A profile picture is a lead, not proof: anyone can use any piece as their picture, and pieces change hands.
      </p>
    </div>
  );
}
