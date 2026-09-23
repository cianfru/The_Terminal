// The "follow our new account" popup (2026-09-23, second version).
//
// The old X account is gone. Owner's brief: one picture, one clear message — follow the new account —
// and make it HARD TO DISMISS: no × in the corner, no click-outside, no Esc. The only way out is a link at
// the very bottom of the card, below the fold on a phone, so the visitor reads past the message first.
// Shown once per browser session (sessionStorage), on every page.
//
// ⚠ Say nothing about WHY the old account went down (owner keeps that private — see CLAUDE.md).
// Styled as the terminal landing: black panel, squared, rainbow hairline, DepartureMono micro-labels,
// Geist copy (the site's one text face — the e2e font check pins it), the green CTA. Phone-first.
//
// To retire it: drop <XNotice/> from App.jsx.
import { useEffect, useRef, useState } from "react";

export const NEW_HANDLE = "lanternlabsmain";
export const SEEN_KEY = "spx-new-account-seen";
const IMG = "/new-account.jpg";

const CSS = `
@font-face{ font-family:'DepartureMono'; font-style:normal; font-weight:400; font-display:swap; src:url(/fonts/DepartureMono-Regular.woff2) format('woff2'); }
.xn-back{ position:fixed; top:0; left:0; width:100vw; height:100dvh; z-index:1000; overflow-y:auto; -webkit-overflow-scrolling:touch;
  display:flex; justify-content:center; align-items:flex-start; padding:24px 16px 40px;
  background:rgba(0,0,0,.82); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); animation:xn-fade .25s ease-out; }
.xn{ position:relative; width:100%; max-width:540px; margin:auto 0; background:#07090e; border:1px solid #243149;
  box-shadow:0 30px 80px rgba(0,0,0,.7); animation:xn-rise .32s cubic-bezier(.2,.8,.2,1); }
.xn:focus{ outline:none; }
.xn-rb{ height:3px; background:linear-gradient(90deg,#5b2a86,#3b49c9,#1f8fe0,#12c2c2,#37d067,#c7d21f,#f0a915,#f2621b,#e5342f); }
.xn-art{ position:relative; background:#000; }
.xn-art img{ display:block; width:100%; height:auto; }
.xn-art::after{ content:""; position:absolute; left:0; right:0; bottom:0; height:34%; background:linear-gradient(transparent,#07090e); }
.xn-body{ padding:8px 28px 0; }
.xn-tag{ font-family:'DepartureMono',ui-monospace,monospace; font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:#37f7a0;
  display:flex; align-items:center; gap:10px; }
.xn-tag i{ width:8px; height:8px; background:#37f7a0; display:inline-block; flex:none; }
.xn h2{ font-family:'Geist',system-ui,sans-serif; font-size:34px; line-height:1.1; font-weight:700; letter-spacing:-.015em;
  color:#f5f7fb; margin:14px 0 14px; text-wrap:balance; }
.xn p{ font-family:'Geist',system-ui,sans-serif; font-size:17px; line-height:1.65; color:#c9d2df; margin:0 0 12px; }
.xn p b{ color:#f5f7fb; font-weight:700; }
.xn-go{ margin:22px 0 0; min-height:56px; display:flex; align-items:center; justify-content:center; gap:12px; background:#4ade80; color:#04110a;
  text-decoration:none; font-family:'DepartureMono',ui-monospace,monospace; font-size:16px; letter-spacing:.08em; text-transform:uppercase; }
.xn-go:hover{ background:#6ee7a0; }
.xn-go svg{ width:18px; height:18px; fill:currentColor; flex:none; }
.xn-handle{ margin:12px 0 0; text-align:center; font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:15px; color:#c9d2df; }
.xn-foot{ margin:36px 0 0; padding:18px 28px 22px; border-top:1px solid #182031; display:flex; justify-content:center; }
.xn-later{ min-height:44px; padding:0 16px; background:transparent; border:0; cursor:pointer; color:#a2adbe;
  font-family:'DepartureMono',ui-monospace,monospace; font-size:13px; letter-spacing:.1em; text-transform:uppercase; text-decoration:underline; text-underline-offset:4px; }
.xn-later:hover{ color:#eef2f8; }
.xn a:focus-visible, .xn button:focus-visible{ outline:2px solid #37f7a0; outline-offset:3px; }
@keyframes xn-fade{ from{opacity:0} to{opacity:1} }
@keyframes xn-rise{ from{opacity:0; transform:translateY(14px)} to{opacity:1; transform:none} }
@media (max-width:560px){ .xn-back{ padding:0 0 32px; } .xn{ border-left:0; border-right:0; }
  .xn-body{ padding:6px 20px 0; } .xn h2{ font-size:28px; } .xn p{ font-size:16px; } .xn-foot{ padding:16px 20px 20px; } }
@media (prefers-reduced-motion:reduce){ .xn-back,.xn{ animation:none } }
`;

const X_ICON = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

export default function XNotice() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch { /* storage blocked: show it */ }
    if (!seen) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = () => { try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* fine */ } setOpen(false); };

  if (!open) return null;
  return (
    <div className="xn-back">
      <style>{CSS}</style>
      <div className="xn" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="xn-title">
        <div className="xn-rb" />
        <div className="xn-art">
          <img src={IMG} alt="Two orbs offered on open palms: a rainbow one and a glitched question mark" />
        </div>
        <div className="xn-body">
          <div className="xn-tag"><i />New account</div>
          <h2 id="xn-title">Follow us on our new account.</h2>
          <p>Our old X account is gone. <b>We're not giving up.</b> We're rebuilding from zero, and we're moving forward.</p>
          <p>Same data. Same charts. Every number still open for anyone to check.</p>
          <a className="xn-go" href={`https://x.com/${NEW_HANDLE}`} target="_blank" rel="noopener noreferrer" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={X_ICON} /></svg>
            Follow @{NEW_HANDLE}
          </a>
          <div className="xn-handle">x.com/{NEW_HANDLE}</div>
        </div>
        <div className="xn-foot">
          <button className="xn-later" onClick={close}>Continue to the charts</button>
        </div>
      </div>
    </div>
  );
}
