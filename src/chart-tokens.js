// SHARED MOBILE CHART TOKENS — one place to tune how every chart behaves on a phone, instead of
// 73 charts each carrying their own `isMobile ? 10 : 12`. Charts read these through
// useChartTokens(); the global rules in terminal.css enforce the floors for charts not yet migrated.
import { useIsMobile, useCoarsePointer } from "./viewport.js";

// Floors from the mobile plan: axis text never below 12px, explanatory copy at least 16px.
// terminal.css repeats them as a CSS safety net; test/chart-tokens.test.mjs pins the pair together.
export const TICK_MIN = 12;
export const BODY_MIN = 16;

export function chartTokens({ mobile = false, coarse = false } = {}) {
  return {
    mobile, coarse,
    // Plot: a phone is portrait, so height is the scarce axis — keep the plot tall enough to read a
    // trend but short enough that the insight above and the explainer below stay on the same screen.
    height: mobile ? 420 : 560,
    margin: { top: 10, right: mobile ? 10 : 20, bottom: mobile ? 20 : 24, left: mobile ? 0 : 12 },
    yWidth: mobile ? 46 : 54,
    // Type. Ticks never shrink on mobile: 10px axis labels were the single commonest legibility
    // failure in the audit. Fewer ticks beats smaller ticks.
    tick: TICK_MIN,
    tickFill: "#cbd5e1",          // a literal: SVG presentation attributes can't resolve var()
    body: mobile ? BODY_MIN : 15,
    caption: mobile ? 15 : 13,
    metricLabel: mobile ? 12 : 11,
    metricValue: mobile ? 26 : 24,
    metricSub: mobile ? 13 : 11,
    // Touch has no hover, so a tap places the tooltip and it STAYS until you tap elsewhere.
    tooltipTrigger: coarse ? "click" : "hover",
  };
}

export const useChartTokens = () => chartTokens({ mobile: useIsMobile(), coarse: useCoarsePointer() });

// How many x-axis ticks fit without collision, given the tick font never shrinks. Charts that build
// their own tick arrays call this instead of hard-coding 6.
export function maxTicks(width, mobile, approxLabelPx = 52) {
  const w = Number.isFinite(width) && width > 0 ? width : (mobile ? 360 : 1100);
  return Math.max(2, Math.floor(w / (approxLabelPx + (mobile ? 14 : 26))));
}

// Tooltip props every chart should spread: on touch a TAP places the tooltip and it STAYS put
// (recharts' click trigger), because there is no hover to depend on.
export function useTipProps(extra = {}) {
  return { trigger: useChartTokens().tooltipTrigger, ...extra };
}
