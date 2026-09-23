// The site's own feed of the daily posts (?view=posts).
//
// ⚠ BUILT 2026-09-23, THE DAY THE X ACCOUNT WAS SUSPENDED. The daily bot now writes every post
// here BEFORE it tries X (scripts/bot/post.mjs → public/site-feed.json + public/feed/<date>-<id>.png),
// so the posts carry on whatever X decides. While the account is down the bot publishes here
// only (repo var BOT_SITE_ONLY, default on); once it is back, both.
//
// The feed is read from raw.githubusercontent, not the deployed bundle: the bot commits with
// GITHUB_TOKEN, which never triggers a deploy, so the deployed copy would sit a day behind.
// Same-origin is the fallback. Card images are the exact PNG the bot rendered that morning —
// never re-rendered from today's data, which would put today's numbers under an old date.
//
// Styling follows CasesPage/DocsPage: one column, rules instead of boxes, readable sizes.
import { useEffect, useState } from "react";
import { SANS, MONO } from "./chart-ui.jsx";
import { SUSPENDED_IMG, COMMS_HANDLE } from "./x-notice.js";

const RAW = "https://raw.githubusercontent.com/cianfru/The_Terminal/main/public/";
const DIM = "#8b98ad", BODY = "#cbd5e1", TEXT = "#f1f5f9", RULE = "#23232a", ACCENT = "#5eead4", WARN = "#fbbf24";


async function loadFeed() {
  for (const base of [RAW, "/"]) {
    try {
      const r = await fetch(`${base}site-feed.json?t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j?.posts)) return { posts: j.posts, base };
    } catch { /* try the next source */ }
  }
  return { posts: [], base: RAW, failed: true };
}

const fmtDate = d => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** The notice itself, shared by the page head. The picture is optional: if it is missing the
 *  notice still reads in full. */
function Notice({ isMobile }) {
  const [img, setImg] = useState(true);
  return (
    <header style={{ marginBottom: 40 }}>
      {img && (
        <img src={SUSPENDED_IMG} alt="Two orbs offered on open palms: a rainbow one and a glitched question mark"
          onError={() => setImg(false)}
          style={{ display: "block", width: "100%", height: "auto", borderRadius: 6, marginBottom: 28, border: `1px solid ${RULE}` }} />
      )}
      <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: WARN, marginBottom: 12 }}>
        Notice · {fmtDate("2026-09-23")}
      </div>
      <h1 style={{ fontFamily: SANS, fontSize: isMobile ? 28 : 38, lineHeight: 1.15, fontWeight: 800, color: TEXT, margin: "0 0 16px", textWrap: "balance" }}>
        Our X account has been suspended.
      </h1>
      <p style={{ fontFamily: SANS, fontSize: isMobile ? 17 : 19, lineHeight: 1.6, color: BODY, margin: 0, maxWidth: 640 }}>
        We're working to reactivate it. In the meantime, follow our posts here.{" "}
        <span style={{ color: ACCENT, fontWeight: 700 }}>Uncensored.</span>
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 14px", marginTop: 22, paddingTop: 16, borderTop: `1px solid ${RULE}` }}>
        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: DIM }}>Comms · reach us on X</span>
        <a href={`https://x.com/${COMMS_HANDLE}`} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: TEXT, textDecoration: "none", minHeight: 40, display: "inline-flex", alignItems: "center" }}>
          @{COMMS_HANDLE} ↗
        </a>
      </div>
    </header>
  );
}

export default function PostsPage({ isMobile }) {
  const [feed, setFeed] = useState(null);
  useEffect(() => { loadFeed().then(setFeed); }, []);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: isMobile ? "28px 16px 80px" : "48px 24px 120px" }}>
      <Notice isMobile={isMobile} />

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12,
                    borderBottom: `1px solid ${RULE}`, paddingBottom: 10, marginBottom: 8 }}>
        <h2 style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: DIM, margin: 0, fontWeight: 600 }}>
          Daily posts
        </h2>
        <span style={{ fontFamily: MONO, fontSize: 13, color: DIM }}>new every day · 08:00 ET</span>
      </div>

      {!feed && <p style={{ fontFamily: SANS, fontSize: 15, color: DIM, padding: "32px 0" }}>Loading posts…</p>}

      {feed && feed.posts.length === 0 && (
        <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.7, color: BODY, padding: "32px 0" }}>
          {feed.failed
            ? "The feed didn't load. Refresh the page to try again."
            : "The first post lands here at 08:00 ET, and every day after that."}
        </p>
      )}

      {feed?.posts.map(p => (
        <article key={p.date} id={p.date} style={{ padding: "32px 0", borderBottom: `1px solid ${RULE}` }}>
          <a href={`#${p.date}`} style={{ fontFamily: MONO, fontSize: 14, color: DIM, textDecoration: "none", display: "inline-block", marginBottom: 14 }}>
            {fmtDate(p.date)}
          </a>
          {p.text && (
            <div style={{ fontFamily: SANS, fontSize: isMobile ? 16 : 17, lineHeight: 1.65, color: TEXT, whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere", marginBottom: 18 }}>
              {p.text}
            </div>
          )}
          {p.img && (
            <a href={`${feed.base}${p.img}`} target="_blank" rel="noopener noreferrer">
              <img src={`${feed.base}${p.img}`} alt={`Chart card: ${p.id}`} loading="lazy"
                style={{ display: "block", width: "100%", height: "auto", borderRadius: 6, border: `1px solid ${RULE}` }} />
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
