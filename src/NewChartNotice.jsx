// "New chart just deployed" card (owner, 2026-09-23): announces the AEON Ledger.
//
// Order: it waits for the "follow our new account" popup (XNotice) to be dismissed, then slides in a
// moment later with a short synthesised chime. If that popup was already seen this session, it shows
// shortly after load. Unlike XNotice it is EASY to dismiss (×, "Later", Esc) and it is shown once per
// browser (localStorage), not once per session; opening the ledger by any route also counts as seen.
//
// Styled as XNotice (black panel, rainbow hairline, DepartureMono tag, Geist copy). Bottom-right card on
// desktop, a bottom sheet on phones. To announce another chart: change ANNOUNCE (a new key re-shows it).
import { useEffect, useRef, useState } from "react";
import { SEEN_KEY as XNOTICE_SEEN } from "./XNotice.jsx";

const ANNOUNCE = { id: "aeonledger", key: "spx-newchart-aeonledger" };   // e2e seeds this key
const XNOTICE_CLOSED = "spx:xnotice-closed";

const CSS = `
.nc{ position:fixed; right:20px; bottom:20px; z-index:900; width:min(400px, calc(100vw - 24px)); background:#07090e;
  border:1px solid #243149; box-shadow:0 24px 70px rgba(0,0,0,.6); animation:nc-in .42s cubic-bezier(.2,.8,.2,1); }
.nc-rb{ height:3px; background:linear-gradient(90deg,#5b2a86,#3b49c9,#1f8fe0,#12c2c2,#37d067,#c7d21f,#f0a915,#f2621b,#e5342f); }
.nc-in{ padding:18px 20px 20px; }
.nc-tag{ font-family:'DepartureMono',ui-monospace,monospace; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#2dd4bf;
  display:flex; align-items:center; gap:9px; padding-right:44px; }
.nc-tag i{ width:8px; height:8px; background:#2dd4bf; display:inline-block; flex:none; animation:nc-blink 1.1s steps(1,end) 3; }
.nc h3{ font-family:'Geist',system-ui,sans-serif; font-size:26px; line-height:1.1; font-weight:700; letter-spacing:-.01em; color:#f5f7fb; margin:10px 0 8px; }
.nc p{ font-family:'Geist',system-ui,sans-serif; font-size:15px; line-height:1.55; color:#c9d2df; margin:0; }
.nc-row{ display:flex; gap:10px; margin-top:16px; }
.nc-go{ flex:1; min-height:46px; display:flex; align-items:center; justify-content:center; background:#2dd4bf; color:#04110e; border:0; cursor:pointer;
  font-family:'DepartureMono',ui-monospace,monospace; font-size:14px; letter-spacing:.08em; text-transform:uppercase; }
.nc-go:hover{ background:#5eead4; }
.nc-later{ min-height:46px; padding:0 16px; background:transparent; border:1px solid #2c3a52; color:#c9d2df; cursor:pointer;
  font-family:'DepartureMono',ui-monospace,monospace; font-size:13px; letter-spacing:.08em; text-transform:uppercase; }
.nc-x{ position:absolute; top:6px; right:6px; width:44px; height:44px; background:transparent; border:0; color:#a2adbe; cursor:pointer; font-size:22px; line-height:1; }
.nc-x:hover, .nc-later:hover{ color:#f5f7fb; }
.nc button:focus-visible{ outline:2px solid #2dd4bf; outline-offset:2px; }
@keyframes nc-in{ from{ opacity:0; transform:translateY(24px) scale(.98) } to{ opacity:1; transform:none } }
@keyframes nc-blink{ 50%{ opacity:0 } }
@media (max-width:560px){ .nc{ right:12px; left:12px; bottom:12px; width:auto; } .nc h3{ font-size:24px; } }
@media (prefers-reduced-motion:reduce){ .nc, .nc-tag i{ animation:none } }
`;

/** A short two-note chime, synthesised (no audio file). Browsers only allow sound after a user gesture;
 *  when the card follows the popup's "Continue" click it plays, otherwise it is silently skipped. */
function chime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === "suspended") { ctx.close(); return; }
    const t0 = ctx.currentTime;
    [[784, 0], [1175, 0.11]].forEach(([f, dt]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(f, t0 + dt);
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + dt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + dt); o.stop(t0 + dt + 0.5);
    });
    setTimeout(() => ctx.close(), 900);
  } catch { /* audio blocked — the card still shows */ }
}

const seen = () => { try { return localStorage.getItem(ANNOUNCE.key) === "1"; } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(ANNOUNCE.key, "1"); } catch { /* fine */ } };

export default function NewChartNotice({ onOpen, onChart }) {
  const [open, setOpen] = useState(false);
  const goRef = useRef(null);

  // Already on the announced chart: that is the point of the card, so it counts as seen (and it hides).
  useEffect(() => { if (onChart) markSeen(); }, [onChart]);

  useEffect(() => {
    if (seen() || onChart) return;
    let t;
    const show = delay => { t = setTimeout(() => { if (seen()) return; setOpen(true); chime(); }, delay); };
    const xSeen = (() => { try { return sessionStorage.getItem(XNOTICE_SEEN) === "1"; } catch { return true; } })();
    if (xSeen) show(1200);
    const onClosed = () => show(450);
    window.addEventListener(XNOTICE_CLOSED, onClosed);
    return () => { clearTimeout(t); window.removeEventListener(XNOTICE_CLOSED, onClosed); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    goRef.current?.focus({ preventScroll: true });
    const k = e => { if (e.key === "Escape") { markSeen(); setOpen(false); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  if (!open || onChart) return null;
  const close = () => { markSeen(); setOpen(false); };
  return (
    <div className="nc" role="dialog" aria-label="New chart: AEON Ledger">
      <style>{CSS}</style>
      <div className="nc-rb" />
      <button type="button" className="nc-x" aria-label="Close" onClick={close}>×</button>
      <div className="nc-in">
        <div className="nc-tag"><i />New chart · just deployed</div>
        <h3>AEON Ledger</h3>
        <p>Every AEON owner&apos;s SPX record, rebuilt from the chain: what they bought, sold, still hold and sent to exchanges, with each owner&apos;s trades on the price chart.</p>
        <div className="nc-row">
          <button ref={goRef} type="button" className="nc-go" onClick={() => { close(); onOpen?.(); }}>Open the ledger →</button>
          <button type="button" className="nc-later" onClick={close}>Later</button>
        </div>
      </div>
    </div>
  );
}
