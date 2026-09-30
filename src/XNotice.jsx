// The "follow us on X" card (owner, 2026-09-30, third version).
//
// A small, friendly card pointing at @lanternlabsmain. The owner asked for it to be LESS AGGRESSIVE than
// the previous version (a full-screen picture that could only be closed from a button below the fold), so
// it is now easy to close: ×, "Not now", Esc, or a tap outside. Shown once per browser session
// (sessionStorage), on the first page of the visit.
//
// ⚠ Say nothing about WHY the old account went down (owner keeps that private — see CLAUDE.md).
// Styled as the terminal landing: black panel, squared, rainbow hairline, DepartureMono micro-labels,
// Geist copy (the site's one text face — the e2e font check pins it), the green CTA. Phone-first.
//
// Closing dispatches "spx:xnotice-closed": the new-chart card and the Deep Field sign-in notice wait for
// it so the cards never stack. To retire it: drop <XNotice/> from App.jsx.
import { useEffect, useRef, useState } from "react";

export const NEW_HANDLE = "lanternlabsmain";
export const SEEN_KEY = "spx-new-account-seen";

const CSS = `
@font-face{ font-family:'DepartureMono'; font-style:normal; font-weight:400; font-display:swap; src:url(/fonts/DepartureMono-Regular.woff2) format('woff2'); }
.xn-back{ position:fixed; top:0; left:0; width:100vw; height:100dvh; z-index:1000; overflow-y:auto;
  display:flex; justify-content:center; align-items:center; padding:24px 16px;
  background:rgba(0,0,0,.6); animation:xn-fade .2s ease-out; }
.xn{ position:relative; width:100%; max-width:420px; background:#07090e; border:1px solid #243149;
  box-shadow:0 24px 64px rgba(0,0,0,.6); animation:xn-rise .28s cubic-bezier(.2,.8,.2,1); }
.xn:focus{ outline:none; }
.xn-rb{ height:3px; background:linear-gradient(90deg,#5b2a86,#3b49c9,#1f8fe0,#12c2c2,#37d067,#c7d21f,#f0a915,#f2621b,#e5342f); }
.xn-body{ padding:24px 26px 22px; }
.xn-x{ position:absolute; top:10px; right:8px; width:44px; height:44px; background:transparent; border:0; cursor:pointer;
  color:#a2adbe; font-size:26px; line-height:1; }
.xn-x:hover{ color:#f5f7fb; }
.xn-tag{ font-family:'DepartureMono',ui-monospace,monospace; font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:#37f7a0;
  display:flex; align-items:center; gap:10px; }
.xn-tag i{ width:8px; height:8px; background:#37f7a0; display:inline-block; flex:none; }
.xn h2{ font-family:'Geist',system-ui,sans-serif; font-size:28px; line-height:1.15; font-weight:700; letter-spacing:-.01em;
  color:#f5f7fb; margin:12px 44px 10px 0; text-wrap:balance; }
.xn p{ font-family:'Geist',system-ui,sans-serif; font-size:17px; line-height:1.6; color:#c9d2df; margin:0; }
.xn-go{ margin:20px 0 0; min-height:52px; display:flex; align-items:center; justify-content:center; gap:12px; background:#4ade80; color:#04110a;
  text-decoration:none; font-family:'DepartureMono',ui-monospace,monospace; font-size:15px; letter-spacing:.08em; text-transform:uppercase; }
.xn-go:hover{ background:#6ee7a0; }
.xn-go svg{ width:17px; height:17px; fill:currentColor; flex:none; }
.xn-later{ margin:8px 0 0; width:100%; min-height:44px; background:transparent; border:0; cursor:pointer; color:#a2adbe;
  font-family:'DepartureMono',ui-monospace,monospace; font-size:13px; letter-spacing:.1em; text-transform:uppercase; }
.xn-later:hover{ color:#eef2f8; }
.xn a:focus-visible, .xn button:focus-visible{ outline:2px solid #37f7a0; outline-offset:3px; }
@keyframes xn-fade{ from{opacity:0} to{opacity:1} }
@keyframes xn-rise{ from{opacity:0; transform:translateY(12px)} to{opacity:1; transform:none} }
@media (max-width:560px){ .xn-body{ padding:22px 20px 18px; } .xn h2{ font-size:25px; } .xn p{ font-size:16px; } }
@media (prefers-reduced-motion:reduce){ .xn-back,.xn{ animation:none } }
`;

const X_ICON = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

export default function XNotice() {
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem(SEEN_KEY) !== "1"; } catch { return true; } });
  const ref = useRef(null);

  const close = () => {
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* fine */ }
    setOpen(false);
    window.dispatchEvent(new Event("spx:xnotice-closed"));
  };

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const k = e => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  if (!open) return null;
  return (
    <div className="xn-back" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <style>{CSS}</style>
      <div className="xn" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="xn-title">
        <div className="xn-rb" />
        <button className="xn-x" onClick={close} aria-label="Close">×</button>
        <div className="xn-body">
          <div className="xn-tag"><i />On X</div>
          <h2 id="xn-title">Follow us on X</h2>
          <p>Chart updates, new tools and on-chain reads, posted at @{NEW_HANDLE}.</p>
          <a className="xn-go" href={`https://x.com/${NEW_HANDLE}`} target="_blank" rel="noopener noreferrer" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={X_ICON} /></svg>
            Follow @{NEW_HANDLE}
          </a>
          <button className="xn-later" onClick={close}>Not now</button>
        </div>
      </div>
    </div>
  );
}
