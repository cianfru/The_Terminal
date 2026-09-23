// Recently viewed charts and recent searches — per-device, localStorage only, never uploaded.
// Discovery aids, not analytics: they exist so a phone visitor can get back to what they just
// looked at without re-navigating a 74-chart catalog.
import { useState, useEffect, useCallback } from "react";

const VIEWED = "spx-recent-charts";
const SEARCHES = "spx-recent-searches";
const MAX_VIEWED = 8;
const MAX_SEARCHES = 6;
const EVT = "spx-recents";

const read = (k) => { try { const a = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
const write = (k, arr) => {
  try { localStorage.setItem(k, JSON.stringify(arr)); } catch { /* private mode / quota */ }
  try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* SSR */ }
};

export const readRecentCharts = () => read(VIEWED);
export const readRecentSearches = () => read(SEARCHES);

// Most-recent-first, de-duplicated, capped.
const push = (k, value, max) => {
  if (!value) return;
  const next = [value, ...read(k).filter(v => v !== value)].slice(0, max);
  write(k, next);
};
export const recordChartView = id => push(VIEWED, id, MAX_VIEWED);
export const recordSearch = q => { const t = String(q || "").trim(); if (t.length >= 2) push(SEARCHES, t, MAX_SEARCHES); };
export const clearRecentSearches = () => write(SEARCHES, []);

// Live view of both lists (updates when this tab or another writes).
export function useRecents() {
  const [state, setState] = useState(() => ({ charts: readRecentCharts(), searches: readRecentSearches() }));
  const sync = useCallback(() => setState({ charts: readRecentCharts(), searches: readRecentSearches() }), []);
  useEffect(() => {
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, [sync]);
  return state;
}
