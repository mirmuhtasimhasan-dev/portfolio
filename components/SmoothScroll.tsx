"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registerLenis } from "@/lib/scrollNav";
import { scrollStore } from "@/lib/scrollStore";
import { progressToStop, stopToSection } from "@/lib/stopMap";

gsap.registerPlugin(ScrollTrigger);

/** How much of a mouse-wheel notch Lenis applies (touchpad stays at 1). */
const WHEEL_NOTCH_SCALE = 0.45;

type Props = {
  /** The tall scroll container that drives master progress. */
  trackId: string;
  /** Runs every GSAP tick after progress is updated (overlays, etc). */
  onTick?: () => void;
};

/**
 * Lenis smooth scroll synced to the GSAP ticker, plus one master ScrollTrigger
 * over the track that writes progress 0..1 into the scroll store.
 * No snapping, no scroll hijacking: native scrollbar and keyboard still work.
 */
export function SmoothScroll({ trackId, onTick }: Props) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollStore.reducedMotion = reduced;

    // Reduced motion keeps native scrolling (no smoothing inertia).
    const lenis = reduced
      ? null
      : new Lenis({
          lerp: 0.09,
          smoothWheel: true,
          // Touchpads send many small, fractional deltas: leave them at 1x.
          // A mouse wheel notch is a large whole-number step (or line-based):
          // scale just those down so one notch moves less.
          wheelMultiplier: 1,
          virtualScroll: (data) => {
            const e = data.event;
            if (e instanceof WheelEvent) {
              const notch = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
              if (notch) data.deltaY *= WHEEL_NOTCH_SCALE;
            }
            return true;
          },
        });
    registerLenis(lenis);
    const raf = (time: number) => lenis?.raf(time * 1000);
    if (lenis) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    const master = ScrollTrigger.create({
      trigger: `#${trackId}`,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        scrollStore.progress = self.progress;
      },
    });
    scrollStore.progress = master.progress;

    const tick = () => {
      scrollStore.stop = progressToStop(scrollStore.progress);
      scrollStore.section = stopToSection(scrollStore.stop);
      onTick?.();
    };
    gsap.ticker.add(tick);
    tick();

    return () => {
      gsap.ticker.remove(tick);
      master.kill();
      registerLenis(null);
      if (lenis) {
        gsap.ticker.remove(raf);
        lenis.destroy();
      }
    };
  }, [trackId, onTick]);

  return null;
}
