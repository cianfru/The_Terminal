// CORE WEB VITALS, measured on real visits and bucketed by device — the plan asks for mobile and
// desktop to be tracked SEPARATELY, because a p75 that mixes a desktop on fibre with a phone on 4G
// hides exactly the problem we're trying to see. track() already tags every event "m" or "d".
//
// No library: LCP, CLS and INP are all readable from PerformanceObserver, and web-vitals would be
// another dependency on the critical path of a page whose weight we're trying to cut.
import { track } from "./track.js";

// Report buckets rather than raw milliseconds: the thresholds are what decisions hang on, the
// exact number of one visit is noise, and a bucket can't fingerprint a visitor.
const bucket = (v, good, poor) => (v <= good ? "good" : v <= poor ? "ni" : "poor");

export function reportVitals() {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;
  let lcp = 0, cls = 0, inp = 0, sent = false;
  const obs = [];
  const on = (type, fn, opts) => {
    try { const o = new PerformanceObserver(fn); o.observe({ type, buffered: true, ...opts }); obs.push(o); } catch { /* unsupported entry type */ }
  };

  on("largest-contentful-paint", l => { for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime); });
  on("layout-shift", l => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; });
  // INP ≈ the worst interaction latency the visitor actually felt.
  on("event", l => { for (const e of l.getEntries()) if (e.duration > inp) inp = e.duration; }, { durationThreshold: 40 });

  // Report once, when the page is backgrounded or torn down — that is the only moment the values
  // are final, and visibilitychange is the one signal mobile browsers reliably deliver (pagehide/
  // unload do not fire on iOS when the tab is swiped away).
  const flush = () => {
    if (sent) return;
    sent = true;
    for (const o of obs) { try { o.disconnect(); } catch { /* already gone */ } }
    if (!lcp && !cls && !inp) return;
    track("vitals", {
      lcp: Math.round(lcp), cls: Math.round(cls * 1000) / 1000, inp: Math.round(inp),
      lcpb: bucket(lcp, 2500, 4000), clsb: bucket(cls, 0.1, 0.25), inpb: bucket(inp, 200, 500),
    });
  };
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  addEventListener("pagehide", flush);
}
