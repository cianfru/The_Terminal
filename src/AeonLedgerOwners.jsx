// AEON Ledger — the owner list, the owner sheet and the AEON gallery (owner brief 2026-09-23).
//
//   ROW      the owner's rarest AEON as a round picture · owner number · SPX held · realized P&L ·
//            unrealized P&L · last buy · last sale. Sharp and wide on desktop, a two-by-two card on phones.
//   PICTURE  tapping it opens the gallery: that piece large (traits, rank, OpenSea) and every other AEON
//            the owner holds, rarest first.
//   ROW TAP  opens the owner sheet. The trade-by-trade chart (buys and sells on the SPX price, realized
//            P&L over time — the case-study view, via the shared PositionDetail) is for Deep Field
//            members; everyone else sees the owner's public figures and a login.
//
// Figures are SPX trading only (average cost, landscape/export.mjs pnlOf); AEON trading is not in them.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadAeonRarity, loadPriceHistory } from "./history-data.js";
import { SANS, MONO } from "./chart-ui.jsx";
import { aeonThumb, openseaUrl, priceLookup, positionFromTrades } from "./aeon-ledger-pos.js";

const PositionDetail = lazy(() => import("./PositionDetail.jsx"));

const CSS = `
.al{--al-up:#34d399;--al-dn:#fb7185;--al-line:rgba(148,163,184,.26);--al-hover:rgba(148,163,184,.08);--al-acc:#2dd4bf}
html[data-theme="light"] .al{--al-up:#047857;--al-dn:#be123c;--al-line:rgba(30,41,59,.2);--al-hover:rgba(30,41,59,.05);--al-acc:#0f766e}
.al-head,.al-wide{display:grid;grid-template-columns:64px minmax(190px,1.5fr) repeat(3,minmax(112px,1fr)) repeat(2,minmax(128px,1.1fr)) 18px;column-gap:18px;align-items:center}
.al-head{padding:0 14px 10px;border-bottom:1px solid var(--al-line)}
.al-head span{font:600 12px/1.2 ${MONO};letter-spacing:.09em;text-transform:uppercase;color:var(--ch-mut)}
.al-head span.r,.al-row .r{text-align:right}
.al-row{padding:14px;border-bottom:1px solid var(--al-line);cursor:pointer;transition:background .12s}
.al-row .al-wide{padding:0}
.al-row:hover{background:var(--al-hover)}
.al-row:focus-visible,.al-pfp:focus-visible,.al-btn:focus-visible,.al-thumb:focus-visible{outline:2px solid var(--al-acc);outline-offset:2px}
.al-v{font:600 17px/1.25 ${MONO};color:var(--ch-ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.al-s{font:400 13px/1.35 ${SANS};color:var(--ch-dim);white-space:nowrap;margin-top:3px;font-variant-numeric:tabular-nums}
.al-k{font:600 11px/1.2 ${MONO};letter-spacing:.09em;text-transform:uppercase;color:var(--ch-mut);margin-bottom:4px}
.al-up{color:var(--al-up)}.al-dn{color:var(--al-dn)}
.al-chev{font:400 22px/1 ${SANS};color:var(--ch-dim)}
.al-pfp{position:relative;padding:0;border:0;background:none;cursor:zoom-in;border-radius:50%;flex:none}
.al-pfp img,.al-pfp .al-mono{display:block;border-radius:50%;object-fit:cover;background:#05050e}
.al-badge{position:absolute;right:-4px;bottom:-3px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;
  background:var(--bg,#08090b);border:1px solid var(--al-line);font:700 11px/20px ${MONO};color:var(--ch-ink);text-align:center}
.al-card{display:none}
@media (max-width:1000px){
  .al-head,.al-wide{display:none}
  .al-row{padding:14px 2px}
  .al-card{display:block}
}
.al-top{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}
.al-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;margin-top:12px;padding-left:2px}
.al-ov{position:fixed;top:0;left:0;width:100vw;height:100dvh;z-index:400;background:rgba(2,4,8,.72);overflow-y:auto;overscroll-behavior:contain}
.al-panel{position:relative;max-width:1120px;margin:40px auto;background:var(--bg,#08090b);border:1px solid var(--al-line);padding:22px 26px 30px}
.al-panel.narrow{max-width:860px}
@media (max-width:760px){.al-panel{margin:0;min-height:100dvh;border:0;padding:14px 16px 40px}}
.al-close{position:sticky;top:0;float:right;z-index:2;min-height:44px;padding:0 16px;cursor:pointer;background:var(--bg,#08090b);
  border:1px solid var(--al-line);color:var(--ch-ink);font:600 14px ${SANS}}
.al-btn{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid var(--al-line);color:var(--ch-ink);
  background:transparent;font:600 14px ${SANS};text-decoration:none;cursor:pointer}
.al-btn.acc{border-color:var(--al-acc);color:var(--al-acc)}
.al-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px}
.al-thumb{padding:0;border:1px solid var(--al-line);background:none;cursor:pointer;text-align:left}
.al-thumb[aria-pressed="true"]{border-color:var(--al-acc);box-shadow:0 0 0 1px var(--al-acc)}
.al-thumb img{display:block;width:100%;aspect-ratio:1;object-fit:cover;background:#05050e}
.al-thumb span{display:block;padding:5px 7px;font:600 12px/1.3 ${MONO};color:var(--ch-ink)}
.al-thumb small{display:block;font:400 11px/1.3 ${SANS};color:var(--ch-dim)}
.al-strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.al-strip .al-thumb{flex:0 0 76px}
.al-tiles{display:flex;flex-wrap:wrap;gap:18px 32px;margin:18px 0}
@media (prefers-reduced-motion:reduce){.al-row{transition:none}}
`;

const VCOL = { "never-sold": "#34d399", holding: "#38bdf8", trimming: "#fbbf24", exited: "#fb7185" };
const VLABEL = { "never-sold": "Never sold", holding: "Holding", trimming: "Trimming", exited: "Exited" };

const big = n => {
  const a = Math.abs(n || 0);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e8 ? 0 : 1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + "k";
  return a < 1 && a > 0 ? n.toFixed(2) : Math.round(n || 0).toLocaleString("en-US");
};
const usd = n => "$" + big(Math.abs(n || 0));
const signed = n => (Math.abs(n) < 0.5 ? "$0" : (n > 0 ? "+" : "−") + usd(n));
const tone = n => (Math.abs(n) < 0.5 ? "" : n > 0 ? "al-up" : "al-dn");
const price = p => (!p ? "—" : p < 0.01 ? "$" + p.toFixed(4) : "$" + p.toFixed(3));
const day = d => (d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");
function Chip({ v }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 13, color: "var(--ch-ink)", whiteSpace: "nowrap" }}>
      <i style={{ width: 9, height: 9, background: VCOL[v], display: "inline-block", flex: "none" }} />{VLABEL[v]}
    </span>
  );
}

/** Round picture of the owner's rarest AEON: thumbnail first, the full render if the thumbnail fails. */
function Avatar({ o, size, onOpen }) {
  const [src, setSrc] = useState(aeonThumb(o.pfp?.img));
  const ring = VCOL[o.verdict] || "#94a3b8";
  const label = o.pfp ? `Owner #${o.n}'s AEON #${o.pfp.id}. Open this owner's ${o.aeon} AEON` : `Owner #${o.n}`;
  return (
    <button type="button" className="al-pfp" aria-label={label} title={o.pfp ? `AEON #${o.pfp.id} · rarity rank ${o.pfp.rank ?? "?"}` : ""}
      onClick={e => { e.stopPropagation(); if (o.pfp) onOpen(o); }} onKeyDown={e => e.stopPropagation()}
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${ring}` }}>
      {src
        ? <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" style={{ width: size, height: size }}
            onError={() => setSrc(s => (s !== o.pfp?.img ? o.pfp?.img : null))} />
        : <span className="al-mono" style={{ width: size, height: size, display: "grid", placeItems: "center", font: `700 ${size / 3}px ${MONO}`, color: "#fff" }}>{o.n}</span>}
      {o.aeon > 1 && <span className="al-badge">{o.aeon}</span>}
    </button>
  );
}

function Leg({ x, none }) {
  if (!x) return <><div className="al-v" style={{ color: "var(--ch-dim)" }}>—</div><div className="al-s">{none}</div></>;
  return <><div className="al-v">{day(x.d)}</div><div className="al-s">{big(x.qty)} SPX · {usd(x.usd)}</div></>;
}

function Row({ o, onOpen, onGallery }) {
  const p = o.pnl || {};
  const open = () => onOpen(o);
  return (
    <div className="al-row" role="button" tabIndex={0} aria-label={`Owner #${o.n}: open the full record`}
      onClick={open} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      {/* desktop: one wide line */}
      <div className="al-wide">
        <Avatar o={o} size={52} onOpen={onGallery} />
        <div style={{ minWidth: 0 }}>
          <div className="al-v" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 18 }}>Owner #{o.n}</div>
          <div className="al-s" style={{ display: "flex", gap: 10, alignItems: "center" }}><Chip v={o.verdict} /><span>{o.aeon} AEON · {o.walletCount} wallet{o.walletCount === 1 ? "" : "s"}</span></div>
        </div>
        <div className="r"><div className="al-v">{big(o.holds)}</div><div className="al-s">{o.holdsUsd ? usd(o.holdsUsd) : "SPX"}</div></div>
        <div className="r"><div className={"al-v " + tone(p.realized)}>{signed(p.realized || 0)}</div><div className="al-s">{p.proceeds ? `on ${usd(p.proceeds)} sold` : "nothing sold"}</div></div>
        <div className="r"><div className={"al-v " + tone(p.unrealized)}>{signed(p.unrealized || 0)}</div><div className="al-s">avg cost {price(p.avgCost)}</div></div>
        <div className="r"><Leg x={p.lastBuy} none="never bought" /></div>
        <div className="r"><Leg x={p.lastSell} none="never sold" /></div>
        <span className="al-chev" aria-hidden="true">›</span>
      </div>
      {/* phones and narrow windows: a card */}
      <div className="al-card">
        <div className="al-top">
          <Avatar o={o} size={56} onOpen={onGallery} />
          <div style={{ minWidth: 0 }}>
            <div className="al-v" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 18 }}>Owner #{o.n}</div>
            <div className="al-s" style={{ whiteSpace: "normal" }}><Chip v={o.verdict} /> · {o.aeon} AEON · {big(o.holds)} SPX</div>
          </div>
          <span className="al-chev" aria-hidden="true">›</span>
        </div>
        <div className="al-grid">
          <div><div className="al-k">Realized</div><div className={"al-v " + tone(p.realized)}>{signed(p.realized || 0)}</div></div>
          <div><div className="al-k">Unrealized</div><div className={"al-v " + tone(p.unrealized)}>{signed(p.unrealized || 0)}</div></div>
          <div><div className="al-k">Last buy</div><Leg x={p.lastBuy} none="never bought" /></div>
          <div><div className="al-k">Last sale</div><Leg x={p.lastSell} none="never sold" /></div>
        </div>
      </div>
    </div>
  );
}

/** Full-screen overlay. Viewport units, not inset:0 — a blurred ancestor would otherwise trap it. */
function Overlay({ onClose, narrow, label, children }) {
  const btn = useRef(null), ov = useRef(null), close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const back = document.activeElement;
    btn.current?.focus();
    // Esc closes only the TOP overlay (the gallery can open over an owner sheet).
    const k = e => { if (e.key === "Escape" && [...document.querySelectorAll(".al-ov")].pop() === ov.current) close.current(); };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", k); back?.focus?.({ preventScroll: true }); };
  }, []);
  // Portalled to the app's theme root: the chart page sits in its own stacking context, which would
  // otherwise leave site chrome (the favorites tab) drawn over the sheet whatever its z-index.
  return createPortal(
    <div className="al"><div ref={ov} className="al-ov" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div className={"al-panel" + (narrow ? " narrow" : "")} onClick={e => e.stopPropagation()}>
        <button ref={btn} type="button" className="al-close" onClick={onClose}>Close ✕</button>
        {children}
      </div>
    </div></div>,
    document.querySelector(".tzone") || document.body,
  );
}

function useRarity(on) {
  const [r, setR] = useState(null);
  useEffect(() => {
    if (!on) return;
    let off = false;
    loadAeonRarity().then(d => { if (!off) setR(new Map((d?.tokens || []).map(t => [t.id, t]))); });
    return () => { off = true; };
  }, [on]);
  return r;
}

function Thumb({ id, rank, tok, on, onPick, total }) {
  return (
    <button type="button" className="al-thumb" aria-pressed={on} onClick={() => onPick(id)} aria-label={`AEON #${id}, rarity rank ${rank ?? "unknown"}`}>
      {tok?.img ? <img src={aeonThumb(tok.img)} alt="" loading="lazy" decoding="async" onError={e => { if (e.currentTarget.src !== tok.img) e.currentTarget.src = tok.img; }} />
        : <div style={{ aspectRatio: 1, background: "#05050e" }} />}
      <span>#{id}<small>rank {rank ?? "?"}{total ? ` of ${total.toLocaleString()}` : ""}</small></span>
    </button>
  );
}

export function Gallery({ o, start, onClose, total = 3333 }) {
  const [id, setId] = useState(start ?? o.pfp?.id);
  const rar = useRarity(true);
  const tok = rar?.get(id);
  const rank = o.pieces.find(p => p[0] === id)?.[1];
  return (
    <Overlay onClose={onClose} narrow label={`Owner #${o.n}'s AEON`}>
      <div style={{ font: `600 12px ${MONO}`, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ch-mut)" }}>Owner #{o.n} · {o.aeon} AEON</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 16 }}>
        <a href={openseaUrl(id)} target="_blank" rel="noopener noreferrer" style={{ flex: "0 1 360px", minWidth: 0 }} aria-label={`AEON #${id} on OpenSea`}>
          {tok?.img ? <img src={tok.img} alt={`AEON #${id}`} style={{ display: "block", width: "100%", aspectRatio: 1, objectFit: "cover", background: "#05050e" }} />
            : <div style={{ width: "100%", aspectRatio: 1, background: "#05050e" }} />}
        </a>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <h3 style={{ font: `700 30px/1.1 ${SANS}`, color: "var(--ch-ink)", margin: 0 }}>AEON #{id}</h3>
          <div style={{ font: `400 16px ${SANS}`, color: "var(--ch-body)", marginTop: 6 }}>Rarity rank <strong style={{ fontFamily: MONO, color: "var(--ch-ink)" }}>{rank ?? tok?.rank ?? "?"}</strong> of {total.toLocaleString()}</div>
          {tok?.traits?.length > 0 && (
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", margin: "16px 0 0" }}>
              {tok.traits.map(t => <div key={t.t} style={{ display: "contents" }}>
                <dt style={{ font: `600 12px/1.7 ${MONO}`, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ch-mut)" }}>{t.t}</dt>
                <dd style={{ margin: 0, font: `400 15px/1.6 ${SANS}`, color: "var(--ch-ink)" }}>{t.v}</dd>
              </div>)}
            </dl>
          )}
          <a className="al-btn acc" style={{ marginTop: 18 }} href={openseaUrl(id)} target="_blank" rel="noopener noreferrer">View on OpenSea ↗</a>
        </div>
      </div>
      {o.pieces.length > 1 && <>
        <div style={{ font: `600 12px ${MONO}`, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ch-mut)", margin: "28px 0 10px" }}>Every AEON this owner holds · rarest first</div>
        <div className="al-thumbs">
          {o.pieces.map(([pid, pr]) => <Thumb key={pid} id={pid} rank={pr} tok={rar?.get(pid)} on={pid === id} onPick={setId} />)}
        </div>
      </>}
    </Overlay>
  );
}

function Tile({ k, v, cls = "", sub }) {
  return <div><div className="al-k">{k}</div><div className={"al-v " + cls} style={{ fontSize: 22 }}>{v}</div>{sub && <div className="al-s">{sub}</div>}</div>;
}

export function OwnerSheet({ o, me, spot, isMobile, onClose, onGallery }) {
  const rar = useRarity(true);
  const [px, setPx] = useState(null);
  const member = !!(me && me.loggedIn && (me.member || me.owner));
  const hasTrades = Array.isArray(o.trades);
  useEffect(() => { if (hasTrades) loadPriceHistory().then(setPx); }, [hasTrades]);
  const p = o.pnl || {};
  const pos = hasTrades && px ? positionFromTrades(o.trades, priceLookup(px), o.holds) : null;
  const pub = (
    <div className="al-tiles">
      <Tile k="SPX held" v={big(o.holds)} sub={spot ? usd(o.holds * spot) + " today" : ""} />
      <Tile k="Avg cost" v={price(p.avgCost)} sub={spot ? "now " + price(spot) : ""} />
      <Tile k="Realized" v={signed(p.realized || 0)} cls={tone(p.realized)} sub={p.proceeds ? `on ${usd(p.proceeds)} sold` : "nothing sold"} />
      <Tile k="Unrealized" v={signed(p.unrealized || 0)} cls={tone(p.unrealized)} sub="on what is held today" />
      <Tile k="Put in" v={usd(p.invested)} sub="SPX bought, at the time" />
      <Tile k="Last buy" v={day(p.lastBuy?.d)} sub={p.lastBuy ? `${big(p.lastBuy.qty)} SPX · ${usd(p.lastBuy.usd)}` : "never bought"} />
      <Tile k="Last sale" v={day(p.lastSell?.d)} sub={p.lastSell ? `${big(p.lastSell.qty)} SPX · ${usd(p.lastSell.usd)}` : "never sold"} />
    </div>
  );
  return (
    <Overlay onClose={onClose} label={`Owner #${o.n}`}>
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", paddingRight: 110 }}>
        <Avatar o={o} size={isMobile ? 72 : 92} onOpen={() => onGallery(o)} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ font: `800 ${isMobile ? 28 : 38}px/1.05 ${SANS}`, letterSpacing: "-0.02em", color: "var(--ch-ink)", margin: 0 }}>Owner #{o.n}</h2>
          <div className="al-s" style={{ whiteSpace: "normal", fontSize: 15, marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Chip v={o.verdict} /><span>{o.aeon} AEON · {o.walletCount} wallet{o.walletCount === 1 ? "" : "s"}{o.firstBuy ? ` · first SPX buy ${o.firstBuy}` : ""}</span>
          </div>
        </div>
      </div>

      {o.pieces?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="al-strip">
            {o.pieces.slice(0, 14).map(([pid, pr]) => <Thumb key={pid} id={pid} rank={pr} tok={rar?.get(pid)} on={false} onPick={id => onGallery(o, id)} />)}
          </div>
          {o.pieces.length > 14 && <button type="button" className="al-btn" style={{ marginTop: 10 }} onClick={() => onGallery(o)}>See all {o.pieces.length} AEON</button>}
        </div>
      )}

      {pos ? (
        <div style={{ marginTop: 22 }}>
          <Suspense fallback={<div className="al-s">Loading the chart…</div>}>
            <PositionDetail bare isMobile={isMobile} px={px} price={spot || undefined}
              pos={{ bag: pos.bag, avgCost: pos.avgCost, realized: pos.realized, buys: pos.buys, sells: pos.sells }} head={{}}
              footer={
                <div style={{ marginTop: 22 }}>
                  <p className="al-s" style={{ whiteSpace: "normal", fontSize: 14, lineHeight: 1.6, maxWidth: 780 }}>
                    Green orbs are SPX bought through a pool or router; red triangles are SPX sold, including sales settled in another token.
                    Also received {big(pos.received)} SPX from other wallets (entered at that day&apos;s price) and sent {big(pos.sentOut)} out (left at average cost, no gain or loss booked — an exchange deposit looks the same on-chain).
                  </p>
                  {o.wallets?.length > 0 && <>
                    <div className="al-k" style={{ marginTop: 16 }}>Wallets · {o.wallets.length}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                      {o.wallets.map(a => <a key={a} href={`https://etherscan.io/address/${a}#tokentxns`} target="_blank" rel="noopener noreferrer"
                        style={{ font: `500 14px ${MONO}`, color: "var(--al-acc)", textDecoration: "none", minHeight: 36, display: "inline-flex", alignItems: "center" }}>{a.slice(0, 6)}…{a.slice(-4)} ↗</a>)}
                    </div>
                  </>}
                </div>
              } />
          </Suspense>
        </div>
      ) : (
        <>
          {pub}
          <div style={{ border: "1px solid var(--al-line)", padding: "18px 20px", marginTop: 6 }}>
            <div style={{ font: `700 17px ${SANS}`, color: "var(--ch-ink)" }}>
              {hasTrades ? "Loading the trade history…" : member ? "The trade-by-trade chart arrives with the next ledger refresh." : "The trade-by-trade chart is for Deep Field members."}
            </div>
            {!hasTrades && <p className="al-s" style={{ whiteSpace: "normal", fontSize: 15, lineHeight: 1.6, margin: "8px 0 0", maxWidth: 720 }}>
              Every buy and sale this owner made, on the SPX price, with realized P&amp;L over time and the wallets behind it — the same view as our case studies.
            </p>}
            {!member && <a className="al-btn acc" style={{ marginTop: 14 }} href="/api/auth?action=login">Log in with X →</a>}
          </div>
        </>
      )}
    </Overlay>
  );
}

const PAGE = 25;

export default function OwnerList({ rows, me, spot, isMobile }) {
  const [sheet, setSheet] = useState(null);
  const [gal, setGal] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const withUsd = o => ({ ...o, holdsUsd: spot ? o.holds * spot : 0 });
  return (
    <div className="al">
      <style>{CSS}</style>
      <div className="al-head" aria-hidden="true">
        <span /><span>Owner</span><span className="r">SPX held</span><span className="r">Realized</span><span className="r">Unrealized</span>
        <span className="r">Last buy</span><span className="r">Last sale</span><span />
      </div>
      {rows.slice(0, shown).map(o => <Row key={o.n} o={withUsd(o)} onOpen={setSheet} onGallery={x => setGal({ o: x })} />)}
      {shown < rows.length && (
        <button type="button" className="al-btn" onClick={() => setShown(shown + PAGE * 2)} style={{ marginTop: 14, width: isMobile ? "100%" : "auto", justifyContent: "center" }}>
          Show more ({(rows.length - shown).toLocaleString()} left)
        </button>
      )}
      {sheet && <OwnerSheet o={sheet} me={me} spot={spot} isMobile={isMobile} onClose={() => setSheet(null)} onGallery={(x, id) => setGal({ o: x, id })} />}
      {gal && <Gallery o={gal.o} start={gal.id} onClose={() => setGal(null)} />}
    </div>
  );
}
