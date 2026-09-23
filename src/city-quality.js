// BATTERY SAVER vs FULL DETAIL for the 3D city. The adaptive-resolution controller (city-drs.js)
// already reacts to a struggling device, but it only ever responds AFTER the frames get slow, and
// it cannot know the visitor would rather trade sharpness for battery on a phone. This is the
// explicit choice, remembered per device; DRS keeps doing its job inside whichever ceiling it sets.
import { useState, useEffect, useCallback } from "react";

export const QUALITY_KEY = "spx-city-quality";
export const QUALITIES = ["saver", "full"];

// Phones default to saver, desktops to full: the default should suit the device it lands on.
export function readQuality(isMobile = false) {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    if (QUALITIES.includes(v)) return v;
  } catch { /* private mode */ }
  return isMobile ? "saver" : "full";
}

// Pixel-ratio ceiling and floor handed to makeDrs(). Saver caps at 1x device pixels (a 3x phone
// screen renders ~9x fewer pixels per frame) and allows a lower floor before DRS gives up.
export function qualityRatios(quality, dpr = 1) {
  const cap = quality === "saver" ? 1 : 2;
  const maxRatio = Math.min(dpr, cap);
  return { maxRatio, minRatio: Math.max(quality === "saver" ? 0.45 : 0.55, maxRatio * 0.4) };
}

export function useQuality(isMobile) {
  const [quality, setQ] = useState(() => readQuality(isMobile));
  useEffect(() => {
    const sync = () => setQ(readQuality(isMobile));
    window.addEventListener("spx-city-quality", sync);
    return () => window.removeEventListener("spx-city-quality", sync);
  }, [isMobile]);
  const set = useCallback(q => {
    if (!QUALITIES.includes(q)) return;
    try { localStorage.setItem(QUALITY_KEY, q); } catch { /* private mode */ }
    setQ(q);
    try { window.dispatchEvent(new CustomEvent("spx-city-quality")); } catch { /* SSR */ }
  }, []);
  return [quality, set];
}
