import { useCoarsePointer } from "./viewport.js";
import { useChartTokens } from "./chart-tokens.js";
import { useState, useRef, useEffect } from "react";
// Shared UI vocabulary for the interactive chart pages. Every chart previously
// re-declared these fonts, the Metric readout, the tooltip container and the
// drag-to-zoom state machine, this is the single source. Add new charts on top
// of these pieces instead of copy-pasting a sibling.
// Fonts follow the landing north star + terminal shell: Geist (sans) / Geist Mono (data,
// labels, axes). Both are loaded in index.html; kept as literals (not CSS vars) so they
// also resolve inside recharts' SVG <text>. Changing these two propagates to every chart.
export const SANS = "'Geist', 'Space Grotesk', system-ui, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
export const MAX_W = 1400;

// Greyscale "ink" values chosen for a DARK ground that go invisible on light. Route them
// through the theme-aware tokens instead, so a neutral metric reads in both themes; vivid
// semantic colours (green/red/amber…) are passed through untouched.
const WHITE_INK = new Set(["#f8fafc", "#f1f5f9", "#f4f6f9", "#fafafa", "#ffffff", "#fff", "#e2e8f0", "#e5e7eb", "#eef2f8"]);
const MUTED_INK = new Set(["#cbd5e1", "#94a3b8", "#aab4c4", "#9aa6b6", "#8b96a8", "#64748b", "#7c8a9e", "#b4bfd0", "#a8b3c4"]);
// The vivid accents are tuned for a near-black ground and fall to ~2:1 on the bright theme. Each
// maps to a token that carries the SAME hue at a readable weight per theme (see terminal.css), so a
// green readout stays green and still passes AA. Charts keep passing plain hexes; this reroutes them.
const ACCENT_VAR = {
  "#4ade80": "green", "#22c55e": "green", "#f87171": "red", "#ef4444": "red",
  "#38bdf8": "sky", "#0ea5e9": "sky", "#7dd3fc": "lightsky", "#a78bfa": "violet", "#8b5cf6": "violet",
  "#fbbf24": "amber", "#eab308": "amber", "#f59e0b": "amber2", "#22d3ee": "cyan",
  "#818cf8": "indigo", "#fb7185": "rose", "#5eead4": "teal",
};
export function inkColor(c) {
  if (!c) return "var(--ch-ink)";
  const k = String(c).toLowerCase();
  if (WHITE_INK.has(k)) return "var(--ch-ink)";
  if (MUTED_INK.has(k)) return "var(--ch-mut)";
  const a = ACCENT_VAR[k];
  return a ? `var(--acc-${a},${k})` : c;
}

// Big-number readout shown in the metrics row above a chart.
export function Metric({ label, value, color = "#f8fafc", sub }) {
  const t = useChartTokens();
  return (
    <div style={{ textAlign: "center", minWidth: 96 }}>
      <div style={{ fontFamily: MONO, fontSize: t.metricLabel, color: "var(--ch-mut,#aab4c4)", letterSpacing: 1.1, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: t.metricValue, fontWeight: 700, color: inkColor(color) }}>{value}</div>
      {sub && <div style={{ fontFamily: SANS, fontSize: t.metricSub, color: "var(--ch-dim,#8b96a8)" }}>{sub}</div>}
    </div>
  );
}

// ONE-LINE INSIGHT — what the chart says right now, above the plot: the current value, which way it
// is moving, and what that means in plain words. On a phone this is often the only thing read, so it
// carries the answer rather than decorating it. `dir` is "up" | "down" | "flat" (or null to omit).
const ARROW = { up: "\u2197", down: "\u2198", flat: "\u2192" };
export function Insight({ value, dir = null, since, meaning, color = "#f8fafc" }) {
  const t = useChartTokens();
  return (
    <div className="chart-insight">
      <span className="chart-insight-v" style={{ fontFamily: MONO, color: inkColor(color) }}>{value}</span>
      {dir && <span className="chart-insight-d" style={{ color: dir === "up" ? inkColor("#4ade80") : dir === "down" ? inkColor("#f87171") : "var(--ch-mut,#aab4c4)" }}>
        {ARROW[dir]}{since ? <span className="chart-insight-s"> {since}</span> : null}
      </span>}
      {meaning && <span className="chart-insight-m" style={{ fontFamily: SANS, fontSize: t.body }}>{meaning}</span>}
    </div>
  );
}


// Tooltip container, charts supply their own rows (and an optional bold title
// line). `style` merges over the defaults for per-chart accents (border, padding).
export function TipBox({ title, style, children }) {
  return (
    <div style={{ background: "rgba(4,4,12,0.97)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: "12px 16px", fontFamily: SANS, fontSize: 13, color: "#cbd5e1", ...style }}>
      {title != null && <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>{title}</div>}
      {children}
    </div>
  );
}

const LIGHT = { "#38bdf8": "#7dd3fc", "#a78bfa": "#c4b5fd" };

// Plain-language explainer box for the more technical charts (NUPL, MVRV, SOPR…). Leads
// with the question the metric answers in human terms, so a general user gets it before
// reading an axis. `q` = the plain question; children = the plain answer.
export function Explain({ q, accent = "#38bdf8", children }) {
  // Just a clean explanation — no box, no bold callout heading. A green ">" prompt leads, then
  // the question and answer flow as one plain paragraph in the site's sans.
  return (
    <div className="chart-explain" style={{ maxWidth: MAX_W, margin: "0 auto 22px", fontFamily: SANS, color: "var(--ch-body,#b4bfd0)", lineHeight: 1.7 }}>
      {q && <><span style={{ color: "var(--acc-green,#4ade80)", fontFamily: MONO, marginRight: 10, fontWeight: 700 }}>&gt;</span>{q}{" "}</>}
      {children}
    </div>
  );
}

// Hover typewriter, identical to the top nav menu: the label types itself out on hover while the
// control reserves its FULL width with an invisible ghost, so nothing reflows as characters stream.
export function useHoverType(text) {
  // Reduced motion: hand back the finished text and make type()/reset() no-ops.
  const still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion:reduce)").matches;
  const [shown, setShown] = useState(text);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { setShown(text); }, [text]);
  const type = () => {
    if (still) return;
    clearTimeout(timer.current);
    let j = 0;
    const step = () => { setShown(text.slice(0, j)); if (j < text.length) { j++; timer.current = setTimeout(step, 42); } };
    setShown(""); step();
  };
  const reset = () => { clearTimeout(timer.current); setShown(text); };
  return { shown, type, reset };
}

// THE app's single button vocabulary — squared (90° corners), mono, uppercase, and it inverts +
// types its label out on hover, exactly like the top menu. Used for every chart-page control
// (share / chart pager / back). icon optional; iconRight puts the icon after the label;
// an empty label makes an icon-only square button. Styling lives in .menubtn (terminal.css, .tzone).
export function MenuBtn({ label = "", icon, iconRight = false, onClick, title, className = "", active = false, style, type: btnType = "button" }) {
  const { shown, type, reset } = useHoverType(label || "");
  return (
    <button type={btnType}
      className={"menubtn" + (active ? " on" : "") + (label ? "" : " ic") + (className ? " " + className : "")}
      onMouseEnter={type} onMouseLeave={reset} onClick={onClick} title={title || label} aria-label={title || label}
      style={style}>
      {icon && !iconRight && <span className="menubtn-ic">{icon}</span>}
      {label !== "" && (
        <span className="menubtn-t"><span className="menubtn-g" aria-hidden="true">{label}<i className="tcur" aria-hidden="true">_</i></span><span className="menubtn-y">{shown}<i className="tcur" aria-hidden="true">_</i></span></span>
      )}
      {icon && iconRight && <span className="menubtn-ic">{icon}</span>}
    </button>
  );
}

// Shared view-toggle row, styled like the site's terminal menu: mono font, squared cells, the
// active view highlighted, and the label types itself out on hover (the menu's typewriter).
// tabs = [[key, label], …]. Replaces every chart's bespoke rounded-pill toggle so they read as
// one system. Styling lives in .vtab CSS (terminal.css, scoped under .tzone).
export function ViewTabs({ tabs, value, onChange, style }) {
  return (
    <div className="viewtabs chart-toolbar" style={style}>
      {tabs.map(([k, l]) => <TypeTab key={k} label={l} on={k === value} onClick={() => onChange(k)} />)}
    </div>
  );
}

// A single squared toggle tab, mono, green when active, and it types its label out on hover —
// the shared toggle vocabulary (view toggles, and the rainbow page's range / target / milestone
// buttons). `sub` is an optional dim suffix (e.g. a target's market cap). Styling: .vtab (.tzone).
export function TypeTab({ label, sub, on, onClick, title, style, className = "" }) {
  const { shown, type, reset } = useHoverType(String(label));
  return (
    <button type="button" className={"vtab" + (on ? " on" : "") + (className ? " " + className : "")}
      onMouseEnter={type} onMouseLeave={reset} onClick={onClick} title={title} style={style}>
      <span className="menubtn-t"><span className="menubtn-g" aria-hidden="true">{label}<i className="tcur" aria-hidden="true">_</i></span><span className="menubtn-y">{shown}<i className="tcur" aria-hidden="true">_</i></span></span>
      {sub != null && <span className="vtsub">{sub}</span>}
    </button>
  );
}

export function ZoomResetButton({ onReset, accent = "#38bdf8", fontSize = 12, padding = "5px 12px" }) {
  return (
    <button onClick={onReset} className="pill" style={{ fontFamily: MONO, fontSize, fontWeight: 600, padding, borderRadius: 0, textTransform: "uppercase", letterSpacing: ".06em", cursor: "pointer", background: "transparent", border: `1px solid ${accent}66`, color: LIGHT[accent] || accent, "--glow": accent }}>
      ⤢ Reset zoom
    </button>
  );
}

// ── BRAND WATERMARK ──────────────────────────────────────────────────────────────────────────
// The site is meant to be shared; the point is that a screenshot still says where it came from.
// Drop <Watermark /> into any chart panel that is position:relative with overflow:hidden — one
// line, no other wiring:
//
//     <div style={{ position:"relative", overflow:"hidden" }}>
//       <Watermark />
//       …the chart…
//     </div>
//
// Two parts, separately controllable. The LOGO is the faint coin mark the rainbow panel has always
// carried. The LABEL is the domain, and it is the half that actually does the job: a 7% logo tells
// a stranger nothing about where a chart came from, while the bot's own shared cards have always
// footed every image with "spx6900rainbow.xyz". This brings the site in line with the cards.
// Both are aria-hidden and pointer-events:none, so nothing here is reachable by a reader or a
// screen reader, and neither can intercept a tap on the plot.
export const SITE = "spx6900rainbow.xyz";

// NOTE the default: label is OFF, so adding <Watermark /> reproduces exactly what production has
// today and changes nothing visually. Turning the domain on is `<Watermark label />` per chart, or
// flip this default to true to switch it on everywhere at once. That decision is the owner's.
export function Watermark({ logo = true, label = false, opacity = 0.07, labelOpacity = 0.34, accent = "var(--ch-mut,#7c8a9e)" }) {
  const { mobile } = useChartTokens();
  return (
    <>
      {logo && (
        <img
          src="/spx6900logo.png" alt="" aria-hidden="true" draggable="false"
          style={{
            position: "absolute", bottom: mobile ? 26 : 44, right: mobile ? "-10%" : -64,
            width: mobile ? "58%" : "42%", maxWidth: 440, opacity, zIndex: 0,
            pointerEvents: "none", userSelect: "none",
          }}
        />
      )}
      {label && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute", bottom: mobile ? 6 : 10, right: mobile ? 10 : 16, zIndex: 3,
            fontFamily: MONO, fontSize: mobile ? 10.5 : 11.5, letterSpacing: ".1em",
            textTransform: "lowercase", color: accent, opacity: labelOpacity,
            pointerEvents: "none", userSelect: "none", whiteSpace: "nowrap",
          }}
        >{SITE}</span>
      )}
    </>
  );
}

// The status row above a zoomable chart: hint text + reset button when zoomed.
export function ZoomBar({ zoomed, onReset, accent = "#38bdf8", viewing = "Viewing a selected window." }) {
  const coarse = useCoarsePointer();
  // The fullscreen viewer this used to point at is gone: iOS Safari refuses requestFullscreen on
  // anything that isn't a <video>, so on iPhone it was only ever a CSS overlay sitting under the
  // URL bar — never actually fullscreen. The browser's own pinch zoom works on the page as-is
  // (nothing here sets user-scalable=no), so that is what touch users are pointed at.
  const hint = coarse ? "Pinch to zoom in on any part of the chart." : "Drag across the chart to zoom into any period.";
  return (
    <div className="chart-zoombar" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10 }}>
      <span style={{ fontFamily: SANS, fontSize: 13, color: "var(--ch-dim,#8b96a8)" }}>{zoomed ? viewing : hint}</span>
      {zoomed && <ZoomResetButton onReset={onReset} accent={accent} />}
    </div>
  );
}
