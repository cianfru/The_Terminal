// The X-suspension notice (2026-09-23): a one-time popup, once per browser session.
//
// The account was suspended and the automatic daily cards are paused. This points visitors at the
// posts page (?view=posts — owner-written posts, published from /control) and says how to reach us.
// Styled as the terminal landing: black panel, squared, rainbow hairline, DepartureMono
// micro-labels, Space Grotesk copy, the green CTA. Not shown on the notice page (?view=posts) itself.
//
// To retire it when X is back: drop <XNotice/> from App.jsx and the .xnotice banner from
// public/landing-next.html.
import { useEffect, useRef, useState } from "react";
import { SUSPENDED_IMG, COMMS_HANDLE } from "./x-notice.js";

const SEEN = "spx-x-notice-seen";

const CSS = `
@font-face{ font-family:'DepartureMono'; font-style:normal; font-weight:400; font-display:swap; src:url(/fonts/DepartureMono-Regular.woff2) format('woff2'); }
.xn-back{ position:fixed; top:0; left:0; width:100vw; height:100dvh; z-index:1000; display:flex; align-items:center; justify-content:center;
  padding:16px; background:rgba(0,0,0,.74); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); animation:xn-fade .25s ease-out; }
.xn{ position:relative; width:100%; max-width:540px; max-height:calc(100dvh - 32px); overflow-y:auto; background:#07090e;
  border:1px solid #243149; box-shadow:0 30px 80px rgba(0,0,0,.7); animation:xn-rise .32s cubic-bezier(.2,.8,.2,1); }
.xn-rb{ height:3px; background:linear-gradient(90deg,#5b2a86,#3b49c9,#1f8fe0,#12c2c2,#37d067,#c7d21f,#f0a915,#f2621b,#e5342f); }
.xn-art{ position:relative; aspect-ratio:3/2; background:#000; overflow:hidden; }
.xn-art img{ display:block; width:100%; height:100%; object-fit:cover; }
.xn-art::after{ content:""; position:absolute; left:0; right:0; bottom:0; height:38%; background:linear-gradient(transparent,#07090e); }
.xn-x{ position:absolute; top:12px; right:12px; z-index:2; width:40px; height:40px; display:grid; place-items:center; cursor:pointer;
  background:rgba(7,9,14,.72); border:1px solid #243149; color:#eef2f8; }
.xn-x:hover{ border-color:#eef2f8; }
.xn:focus{ outline:none; }
.xn-x:focus-visible, .xn a:focus-visible, .xn button:focus-visible{ outline:2px solid #37f7a0; outline-offset:2px; }
.xn-body{ padding:6px 28px 28px; }
.xn-tag{ font-family:'DepartureMono',ui-monospace,monospace; font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:#fbbf24;
  display:flex; align-items:center; gap:10px; }
.xn-tag i{ width:8px; height:8px; background:#fbbf24; display:inline-block; }
.xn h2{ font-family:'Space Grotesk','SpaceGrotesk',system-ui,sans-serif; font-size:32px; line-height:1.1; font-weight:700; letter-spacing:-.01em;
  color:#f5f7fb; margin:14px 0 12px; text-wrap:balance; }
.xn p{ font-family:'Space Grotesk','SpaceGrotesk',system-ui,sans-serif; font-size:17px; line-height:1.6; color:#c3ccda; margin:0; }
.xn p b{ color:#37f7a0; font-weight:700; }
.xn-comms{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin:22px 0 0; padding:14px 0; border-top:1px solid #182031; border-bottom:1px solid #182031; }
.xn-comms span{ font-family:'DepartureMono',ui-monospace,monospace; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#a2adbe; }
.xn-comms a{ font-family:'Geist Mono',ui-monospace,'SF Mono',Menlo,monospace; font-size:16px; font-weight:600; color:#eef2f8; text-decoration:none;
  display:inline-flex; align-items:center; gap:8px; min-height:40px; }
.xn-comms a:hover{ color:#37f7a0; }
.xn-comms svg{ width:15px; height:15px; fill:currentColor; }
.xn-act{ display:flex; gap:10px; margin-top:22px; }
.xn-go{ flex:1; min-height:48px; display:flex; align-items:center; justify-content:center; gap:10px; background:#4ade80; color:#04110a; border:0; cursor:pointer;
  font-family:'DepartureMono',ui-monospace,monospace; font-size:15px; letter-spacing:.08em; text-transform:uppercase; text-decoration:none; }
.xn-go:hover{ background:#6ee7a0; }
.xn-later{ min-height:48px; padding:0 20px; background:transparent; color:#a2adbe; border:1px solid #243149; cursor:pointer;
  font-family:'DepartureMono',ui-monospace,monospace; font-size:14px; letter-spacing:.08em; text-transform:uppercase; }
.xn-later:hover{ color:#eef2f8; border-color:#a2adbe; }
@keyframes xn-fade{ from{opacity:0} to{opacity:1} }
@keyframes xn-rise{ from{opacity:0; transform:translateY(14px)} to{opacity:1; transform:none} }
@media (max-width:560px){ .xn-body{ padding:4px 20px 22px } .xn h2{ font-size:26px } .xn p{ font-size:16px }
  .xn-comms{ flex-direction:column; align-items:flex-start; gap:2px } .xn-art{ aspect-ratio:16/10 } }
@media (prefers-reduced-motion:reduce){ .xn-back,.xn{ animation:none } }
`;

export default function XNotice({ route, onOpen }) {
  const [open, setOpen] = useState(false);
  const goRef = useRef(null); // the dialog itself takes focus on open (Esc + Tab work, no stray ring)

  useEffect(() => {
    if (route === "posts") return;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN) === "1"; } catch { /* storage blocked: show it */ }
    if (!seen) setOpen(true);
  }, [route]);

  const close = () => {
    try { sessionStorage.setItem(SEEN, "1"); } catch { /* fine */ }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    goRef.current?.focus();
    const onKey = e => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!open || route === "posts") return null;
  return (
    <div className="xn-back" onClick={close}>
      <style>{CSS}</style>
      <div className="xn" ref={goRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="xn-title" onClick={e => e.stopPropagation()}>
        <div className="xn-rb" />
        <div className="xn-art">
          <img src={SUSPENDED_IMG} alt="Two orbs offered on open palms: a rainbow one and a glitched question mark" />
          <button className="xn-x" onClick={close} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>
          </button>
        </div>
        <div className="xn-body">
          <div className="xn-tag"><i />Notice · 23 Sep 2026</div>
          <h2 id="xn-title">Our X account has been suspended.</h2>
          <p>We're working to reactivate it. In the meantime, follow our posts here. <b>Uncensored.</b></p>
          <div className="xn-comms">
            <span>Comms · reach us on X</span>
            <a href={`https://x.com/${COMMS_HANDLE}`} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              @{COMMS_HANDLE}
            </a>
          </div>
          <div className="xn-act">
            <button className="xn-go" onClick={() => { close(); onOpen(); }}>&gt; Read the posts</button>
            <button className="xn-later" onClick={close}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
