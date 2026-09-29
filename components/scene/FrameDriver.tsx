"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { scrollStore } from "@/lib/scrollStore";

/*
 * Drives the canvas instead of R3F's own loop (the Canvas runs with
 * frameloop="never"). Full display rate while anything is happening; after
 * 2 s with no scroll, hover, drag, key or camera movement it drops to about
 * 30 fps, and snaps back to full speed on the very next input. Stops
 * entirely while `active` is false (tab hidden or canvas off screen).
 */

const IDLE_AFTER_MS = 2000;
const IDLE_FPS = 30;
const EVENTS = ["wheel", "scroll", "pointermove", "pointerdown", "pointerup", "keydown", "touchstart", "touchmove"] as const;

export function FrameDriver({ active }: { active: boolean }) {
  const advance = useThree((s) => s.advance);

  useEffect(() => {
    if (!active) return;
    let lastInput = performance.now();
    let lastRender = 0;
    let lastProgress = scrollStore.progress;
    let raf = 0;

    const onInput = () => {
      const idle = performance.now() - lastInput > IDLE_AFTER_MS;
      lastInput = performance.now();
      // Coming out of the slow mode: render on this very frame.
      if (idle) lastRender = 0;
    };
    EVENTS.forEach((e) => window.addEventListener(e, onInput, { passive: true }));

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      // Still moving (Lenis easing out, camera damping) counts as activity.
      if (scrollStore.progress !== lastProgress) {
        lastProgress = scrollStore.progress;
        lastInput = t;
      }
      const idle = t - lastInput > IDLE_AFTER_MS;
      if (idle && t - lastRender < 1000 / IDLE_FPS - 2) return;
      lastRender = t;
      advance(t);
      // The camera still easing toward its scroll target keeps full speed.
      if (scrollStore.cameraSettling) lastInput = t;
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      EVENTS.forEach((e) => window.removeEventListener(e, onInput));
    };
  }, [active, advance]);

  return null;
}
