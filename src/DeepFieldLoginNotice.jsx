// The Deep Field sign-in notice (owner, 2026-09-28): every time someone reaches the Deep Field sign-in
// screen, explain that X sign-in can't be processed since the X account was suspended, and that an
// invite code is a DM away. Shown on EVERY visit to the sign-in screen — no "seen" memory, by design.
// Easy to dismiss (×, "I have a code", Esc, click outside). If the follow-us-on-X card is still up (first page of a session),
// this waits for it to close so the two never stack.
//
// ⚠ Say nothing about WHY the account was suspended (owner keeps that private — see CLAUDE.md).
// Reuses the follow-us-on-X card's look: black panel, squared, rainbow hairline, DepartureMono labels.
import { useEffect, useRef, useState } from "react";
import { NEW_HANDLE, SEEN_KEY } from "./XNotice.jsx";

const CSS = `
.dfn-back{ position:fixed; top:0; left:0; width:100vw; height:100dvh; z-index:1001; overflow-y:auto; -webkit-overflow-scrolling:touch;
  display:flex; justify-content:center; align-items:center; padding:24px 16px; background:rgba(0,0,0,.78);
  backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); animation:dfn-fade .2s ease-out; }
.dfn{ position:relative; width:100%; max-width:480px; background:#07090e; border:1px solid #243149; text-align:left;
  box-shadow:0 30px 80px rgba(0,0,0,.7); animation:dfn-rise .28s cubic-bezier(.2,.8,.2,1); }
.dfn:focus{ outline:none; }
.dfn-rb{ height:3px; background:linear-gradient(90deg,#5b2a86,#3b49c9,#1f8fe0,#12c2c2,#37d067,#c7d21f,#f0a915,#f2621b,#e5342f); }
.dfn-body{ padding:26px 28px 24px; }
.dfn-x{ position:absolute; top:12px; right:10px; width:44px; height:44px; background:transparent; border:0; cursor:pointer;
  color:#a2adbe; font-size:26px; line-height:1; }
.dfn-x:hover{ color:#f5f7fb; }
.dfn-tag{ font-family:'DepartureMono',ui-monospace,monospace; font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:#fbbf24;
  display:flex; align-items:center; gap:10px; }
.dfn-tag i{ width:8px; height:8px; background:#fbbf24; display:inline-block; flex:none; }
.dfn h2{ font-family:'Geist',system-ui,sans-serif; font-size:28px; line-height:1.15; font-weight:700; letter-spacing:-.01em;
  color:#f5f7fb; margin:14px 44px 14px 0; text-wrap:balance; }
.dfn p{ font-family:'Geist',system-ui,sans-serif; font-size:17px; line-height:1.6; color:#c9d2df; margin:0 0 12px; }
.dfn p b{ color:#f5f7fb; font-weight:700; }
.dfn-go{ margin:20px 0 0; min-height:52px; display:flex; align-items:center; justify-content:center; gap:12px; background:#4ade80; color:#04110a;
  text-decoration:none; font-family:'DepartureMono',ui-monospace,monospace; font-size:15px; letter-spacing:.08em; text-transform:uppercase; }
.dfn-go:hover{ background:#6ee7a0; }
.dfn-go svg{ width:17px; height:17px; fill:currentColor; flex:none; }
.dfn-code{ margin:10px 0 0; width:100%; min-height:48px; background:transparent; border:1px solid #334155; cursor:pointer; color:#e2e8f0;
  font-family:'DepartureMono',ui-monospace,monospace; font-size:14px; letter-spacing:.08em; text-transform:uppercase; }
.dfn-code:hover{ border-color:#94a3b8; color:#f5f7fb; }
.dfn a:focus-visible, .dfn button:focus-visible{ outline:2px solid #37f7a0; outline-offset:3px; }
@keyframes dfn-fade{ from{opacity:0} to{opacity:1} }
@keyframes dfn-rise{ from{opacity:0; transform:translateY(12px)} to{opacity:1; transform:none} }
@media (max-width:560px){ .dfn-body{ padding:22px 20px 20px; } .dfn h2{ font-size:24px; } .dfn p{ font-size:16px; } }
@media (prefers-reduced-motion:reduce){ .dfn-back,.dfn{ animation:none } }
`;

const X_ICON = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

export default function DeepFieldLoginNotice({ onClose }) {
  // Open straight away unless the follow-us-on-X card is still up this session (then after it closes).
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem(SEEN_KEY) === "1"; } catch { return false; } });
  const ref = useRef(null);

  useEffect(() => {
    if (open) return;
    const later = () => setOpen(true);
    window.addEventListener("spx:xnotice-closed", later);
    return () => window.removeEventListener("spx:xnotice-closed", later);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => { setOpen(false); onClose?.(); };

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const k = e => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div className="dfn-back" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <style>{CSS}</style>
      <div className="dfn" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dfn-title">
        <div className="dfn-rb" />
        <button className="dfn-x" onClick={close} aria-label="Close">×</button>
        <div className="dfn-body">
          <div className="dfn-tag"><i />Deep Field · sign-in</div>
          <h2 id="dfn-title">We can't process X sign-ins right now.</h2>
          <p>Our X account was suspended, so signing in to Deep Field with X no longer works.</p>
          <p>Deep Field is <b>invite-only</b> in the meantime. <b>Send us a DM on X</b> and we'll give you an invite code.</p>
          <a className="dfn-go" href={`https://x.com/${NEW_HANDLE}`} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={X_ICON} /></svg>
            DM @{NEW_HANDLE}
          </a>
          <button className="dfn-code" onClick={close}>I have a code</button>
        </div>
      </div>
    </div>
  );
}
