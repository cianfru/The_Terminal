// Dialog behaviour every overlay owes a keyboard or screen-reader user: focus moves IN when it
// opens, Tab cycles INSIDE it rather than wandering behind, Escape closes it, and focus returns to
// whatever opened it. Written once because the site has several overlays (the Explore springboard,
// the fullscreen chart viewer, popovers) and each had invented its own partial version.
import { useEffect } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const visible = el => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
};
export const focusableIn = root => (root ? [...root.querySelectorAll(FOCUSABLE)].filter(visible) : []);

export function useDialog(open, ref, onClose, { autoFocus = true } = {}) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const node = ref.current;
    // Remember where focus came from so it can be handed back on close. Without this, closing the
    // sheet drops focus to the top of the document and a keyboard user restarts from scratch.
    const opener = document.activeElement;

    if (autoFocus) {
      const first = focusableIn(node)[0];
      if (first) first.focus();
      else { node.setAttribute("tabindex", "-1"); node.focus(); }
    }

    const onKey = e => {
      if (e.key === "Escape") { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== "Tab") return;
      const items = focusableIn(node);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      // Wrap at both ends, and pull focus back in if it has escaped the dialog entirely.
      if (!node.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Hand focus back when it would otherwise be LOST — either it is still inside the dialog, or
      // the dialog unmounted and focus fell to <body>. If the user has already clicked something
      // else, leave it alone; yanking focus back would be its own bug.
      // (The Explore sheet remounts on every toggle, so by cleanup time its node is already
      // detached and `contains` is false — checking only that missed every real case.)
      const now = document.activeElement;
      const lost = !now || now === document.body || now === document.documentElement || node.contains(now);
      if (lost && opener && typeof opener.focus === "function" && opener.isConnected) opener.focus();
    };
  }, [open, ref, onClose, autoFocus]);
}
