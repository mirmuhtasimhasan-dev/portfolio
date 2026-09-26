import type Lenis from "lenis";
import { TRACK_ID } from "./sections";
import { holdProgress } from "./stopMap";

let lenis: Lenis | null = null;

/** Called by SmoothScroll; null when Lenis is off (reduced motion). */
export function registerLenis(instance: Lenis | null) {
  lenis = instance;
}

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Scroll to a point inside a section's hold zone (phase 0..1, default middle). The camera still only moves
 * because the scroll position moves, so it follows the path exactly as if the
 * user had scrolled there.
 */
export function scrollToSection(index: number, phase = 0.5) {
  const track = document.getElementById(TRACK_ID);
  if (!track) return;
  const top = track.getBoundingClientRect().top + window.scrollY;
  const range = track.offsetHeight - window.innerHeight;
  const y = index === 0 ? 0 : top + holdProgress(index, phase) * range;

  if (!lenis) {
    // Reduced motion: jump; the camera cuts with a fade.
    window.scrollTo({ top: y, behavior: "auto" });
    return;
  }
  const distance = Math.abs(y - window.scrollY) / Math.max(1, range);
  lenis.scrollTo(y, { duration: 1.2 + distance * 2.2, easing: easeInOutCubic });
}
