import { useEffect, useState } from "react";

// ONE mobile breakpoint for the whole site. CSS cannot read a JS constant, so the media queries in
// src/terminal.css (the hamburger/springboard switch) and public/landing-next.html (menu + CTA swap)
// repeat the same number; test/mobile-breakpoint.test.mjs fails the build if any of them drift.
// JS uses matchMedia on the SAME query string so "isMobile" flips on exactly the pixel CSS does
// (a plain `innerWidth < N` disagrees with `max-width:N` by one pixel and ignores zoom/scrollbars).
export const MOBILE_BP = 760;
export const MOBILE_MQ = `(max-width:${MOBILE_BP}px)`;
export const TABLET_BP = 980;
export const COARSE_MQ = "(pointer:coarse)";

// true when the viewport matches `query`; SSR/no-window → false. Re-evaluates on change.
export function useMedia(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return on;
}

export const useIsMobile = () => useMedia(MOBILE_MQ);
// touch-first device (phones/tablets): no hover, imprecise pointer → swap drag hints for swipe hints
export const useCoarsePointer = () => useMedia(COARSE_MQ);
export const isCoarsePointer = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(COARSE_MQ).matches;
export const isMobileWidth = () => typeof window !== "undefined" && (window.innerWidth || (typeof screen !== "undefined" && screen.width) || 1024) <= MOBILE_BP;

// Viewport width in px (resize-tracked) for size math that needs a number, not a boolean.
export function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1400);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}
