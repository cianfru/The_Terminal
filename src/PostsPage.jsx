// The X-suspension notice + the site's own posts (?view=posts).
//
// ⚠ 2026-09-23: the X account was suspended. The automatic daily cards are paused everywhere (the site
// already carries every chart); what lives here instead are posts the OWNER writes by hand in the
// control panel (/control → ✍ Site posts → api/control.js "sitepost-save" → public/site-feed.json +
// public/feed/<id>.<ext>). Both files are deploy-ignored, so the feed is read at runtime: first through
// /api/control?f= (GitHub Contents API, no CDN cache — a post shows the moment it is published), then
// raw.githubusercontent as the fallback. Images come from raw (a new post = a new file name, so the
// CDN never serves a stale one).
//
// Full-bleed and styled as the terminal landing (public/landing-next.html), not the old navy shell:
// the homepage banner and popup open this page, so it must feel like the same site. Phone-first:
// one column, 16px gutter, tap targets ≥ 44px, nothing hover-only.
import { useEffect, useState } from "react";
import { SUSPENDED_IMG, COMMS_HANDLE } from "./x-notice.js";

const RAW = "https://raw.githubusercontent.com/cianfru/The_Terminal/main/public/";

async function loadFeed() {
  const sources = [`/api/control?f=public/site-feed.json&t=${Date.now()}`, `${RAW}site-feed.json?t=${Date.now()}`];
  for (const url of sources) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j?.posts)) return { posts: j.posts };
    } catch { /* try the next source */ }
  }
  return { posts: [], failed: true };
}

const when = p => {
  const d = new Date(p.ts || `${p.date}T12:00:00Z`);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return p.ts ? `${date} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : date;
};

const CSS = `
@font-face{ font-family:'DepartureMono'; font-style:normal; font-weight:400; font-display:swap; src:url(/fonts/DepartureMono-Regular.woff2) format('woff2'); }
.pp{ position:fixed; top:0; left:0; width:100vw; height:100dvh; z-index:60; overflow-y:auto; overflow-x:hidden;
  background:#08090b; color:#eef2f8; -webkit-overflow-scrolling:touch;
  --tx:#eef2f8; --dim:#a2adbe; --line:#182031; --line2:#243149; --live:#37f7a0; --warn:#fbbf24;
  --pix:'DepartureMono',ui-monospace,monospace; --sans:'Geist',system-ui,sans-serif; }
.pp *{ box-sizing:border-box; }
.pp-wrap{ max-width:720px; margin:0 auto; padding:0 16px 96px; }
.pp-bar{ position:sticky; top:0; z-index:2; background:rgba(8,9,11,.92); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
  border-bottom:1px solid var(--line); }
.pp-bar-in{ max-width:720px; margin:0 auto; padding:10px 16px; display:flex; align-items:center; gap:12px; }
.pp-brand{ display:flex; align-items:center; gap:10px; min-height:44px; background:none; border:0; padding:0; cursor:pointer; color:var(--tx);
  font-family:var(--pix); font-size:17px; letter-spacing:.01em; }
.pp-brand svg{ width:30px; height:30px; flex:none; }
.pp-nav{ margin-left:auto; display:flex; gap:8px; }
.pp-nav button{ min-height:44px; padding:0 14px; background:transparent; border:1px solid var(--line2); color:var(--tx); cursor:pointer;
  font-family:var(--pix); font-size:13px; letter-spacing:.1em; text-transform:uppercase; }
.pp-nav button:hover{ border-color:var(--tx); }
.pp-rb{ height:3px; background:linear-gradient(90deg,#5b2a86,#3b49c9,#1f8fe0,#12c2c2,#37d067,#c7d21f,#f0a915,#f2621b,#e5342f); }
.pp-hero{ margin:28px 0 0; border:1px solid var(--line2); background:#000; }
.pp-hero img{ display:block; width:100%; height:auto; }
.pp-tag{ font-family:var(--pix); font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:var(--warn);
  display:flex; align-items:center; gap:10px; margin:28px 0 0; }
.pp-tag i{ width:8px; height:8px; background:var(--warn); display:inline-block; flex:none; }
.pp h1{ font-family:var(--sans); font-weight:700; font-size:40px; line-height:1.08; letter-spacing:-.015em; margin:14px 0 14px; text-wrap:balance; }
.pp-lede{ font-family:var(--sans); font-size:19px; line-height:1.6; color:#c3ccda; margin:0; max-width:36em; }
.pp-lede b{ color:var(--live); font-weight:700; }
.pp-comms{ display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px 16px; margin:26px 0 0; padding:12px 0;
  border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.pp-comms span{ font-family:var(--pix); font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); }
.pp-comms a{ display:inline-flex; align-items:center; gap:8px; min-height:44px; color:var(--tx); text-decoration:none;
  font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:16px; font-weight:600; }
.pp-comms a:hover{ color:var(--live); }
.pp-comms svg{ width:15px; height:15px; fill:currentColor; }
.pp-sec{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin:48px 0 0; padding-bottom:10px; border-bottom:1px solid var(--line2); }
.pp-sec h2{ margin:0; font-family:var(--pix); font-weight:400; font-size:15px; letter-spacing:.14em; text-transform:uppercase; color:var(--tx); }
.pp-sec span{ font-family:var(--pix); font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--dim); }
.pp-post{ padding:28px 0; border-bottom:1px solid var(--line); }
.pp-when{ display:inline-flex; align-items:center; min-height:32px; font-family:var(--pix); font-size:13px; letter-spacing:.08em; color:var(--dim); text-decoration:none; margin-bottom:10px; }
.pp-when:hover{ color:var(--tx); }
.pp-text{ font-family:var(--sans); font-size:18px; line-height:1.65; color:var(--tx); white-space:pre-wrap; overflow-wrap:anywhere; margin:0; }
.pp-img{ display:block; margin-top:16px; border:1px solid var(--line2); background:#000; }
.pp-img img{ display:block; width:100%; height:auto; }
.pp-empty{ font-family:var(--sans); font-size:17px; line-height:1.65; color:var(--dim); padding:28px 0; margin:0; }
.pp-cta{ margin-top:36px; width:100%; min-height:52px; display:flex; align-items:center; justify-content:center; background:#4ade80; color:#04110a;
  border:0; cursor:pointer; font-family:var(--pix); font-size:15px; letter-spacing:.1em; text-transform:uppercase; }
.pp-cta:hover{ background:#6ee7a0; }
.pp button:focus-visible, .pp a:focus-visible{ outline:2px solid var(--live); outline-offset:2px; }
@media (max-width:560px){
  .pp h1{ font-size:30px; } .pp-lede{ font-size:17px; } .pp-text{ font-size:17px; }
  .pp-brand span{ font-size:15px; } .pp-nav button{ padding:0 12px; }
  .pp-hero{ margin-top:0; margin-left:-16px; margin-right:-16px; border:0; border-bottom:1px solid var(--line2); }
  .pp-img{ margin-left:-16px; margin-right:-16px; border-left:0; border-right:0; }
  .pp-comms{ flex-direction:column; align-items:flex-start; }
}
`;

const ARCS = [
  ["M 38.01 10.79 Q 50 -1.16 61.99 10.79", "#e5342f"], ["M 26.34 16.52 Q 50 6.31 73.66 16.52", "#f2621b"],
  ["M 17.04 25.61 Q 50 18.18 82.96 25.61", "#f0a915"], ["M 11.06 37.16 Q 50 33.25 88.94 37.16", "#c7d21f"],
  ["M 9.00 50.00 Q 50 50.00 91.00 50.00", "#37d067"], ["M 11.06 62.84 Q 50 66.75 88.94 62.84", "#12c2c2"],
  ["M 17.04 74.39 Q 50 81.82 82.96 74.39", "#1f8fe0"], ["M 26.34 83.48 Q 50 93.69 73.66 83.48", "#3b49c9"],
  ["M 38.01 89.21 Q 50 101.16 61.99 89.21", "#5b2a86"],
];

export default function PostsPage({ onHome, onExplore }) {
  const [feed, setFeed] = useState(null);
  const [hero, setHero] = useState(true);
  useEffect(() => { loadFeed().then(setFeed); }, []);

  return (
    <div className="pp">
      <style>{CSS}</style>
      <div className="pp-rb" />
      <header className="pp-bar">
        <div className="pp-bar-in">
          <button className="pp-brand" onClick={onHome} aria-label="SPX6900 Rainbow home">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              {ARCS.map(([d, c]) => <path key={d} d={d} stroke={c} strokeWidth="3.3" strokeLinecap="round" fill="none" />)}
            </svg>
            <span>SPX6900/Rainbow</span>
          </button>
          <nav className="pp-nav"><button onClick={onExplore}>Charts</button></nav>
        </div>
      </header>

      <main className="pp-wrap">
        {hero && (
          <div className="pp-hero">
            <img src={SUSPENDED_IMG} alt="Two orbs offered on open palms: a rainbow one and a glitched question mark"
              onError={() => setHero(false)} />
          </div>
        )}
        <div className="pp-tag"><i />Notice · 23 Sep 2026</div>
        <h1>Our X account has been suspended.</h1>
        <p className="pp-lede">We're working to reactivate it. In the meantime, follow our posts here. <b>Uncensored.</b></p>
        <div className="pp-comms">
          <span>Comms · reach us on X</span>
          <a href={`https://x.com/${COMMS_HANDLE}`} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            @{COMMS_HANDLE}
          </a>
        </div>

        <div className="pp-sec">
          <h2>Posts</h2>
          {feed?.posts.length > 0 && <span>{feed.posts.length} {feed.posts.length === 1 ? "post" : "posts"}</span>}
        </div>

        {!feed && <p className="pp-empty">Loading posts…</p>}
        {feed && feed.posts.length === 0 && (
          <p className="pp-empty">{feed.failed ? "The posts didn't load. Refresh the page to try again." : "No posts yet. Check back soon."}</p>
        )}
        {feed?.posts.map(p => (
          <article key={p.id || p.date} id={p.id || p.date} className="pp-post">
            <a className="pp-when" href={`#${p.id || p.date}`}>{when(p)}</a>
            {p.text && <p className="pp-text">{p.text}</p>}
            {p.img && (
              <a className="pp-img" href={`${RAW}${p.img}`} target="_blank" rel="noopener noreferrer">
                <img src={`${RAW}${p.img}`} alt="" loading="lazy" />
              </a>
            )}
          </article>
        ))}

        <button className="pp-cta" onClick={onExplore}>&gt; Explore the charts</button>
      </main>
    </div>
  );
}
