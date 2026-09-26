"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";
import gsap from "gsap";
import { SmoothScroll } from "./SmoothScroll";
import { Overlays, type OverlaysHandle } from "./Overlays";
import { DebugOverlay } from "./DebugOverlay";
import { Nav } from "./Nav";
import { AboutCard } from "./AboutCard";
import { TRACK_ID, TRACK_VH } from "@/lib/sections";
import { ToolTooltip } from "./ToolTooltip";
import { HOLDS } from "@/lib/stopMap";

// Text first; the WebGL canvas loads after, client only.
const Scene = dynamic(() => import("./scene/Scene"), { ssr: false });

export function Experience() {
  const overlays = useRef<OverlaysHandle>(null);
  const fade = useRef<HTMLDivElement>(null);

  const onTick = useCallback(() => overlays.current?.update(), []);

  // Reduced motion: soft fade cut between stop frames.
  const onCut = useCallback((apply: () => void) => {
    const el = fade.current;
    if (!el) return apply();
    gsap.killTweensOf(el);
    gsap.to(el, {
      opacity: 1,
      duration: 0.3,
      ease: "power1.in",
      onComplete: () => {
        apply();
        gsap.to(el, { opacity: 0, duration: 0.5, delay: 0.05, ease: "power1.out" });
      },
    });
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-0">
        <Scene onCut={onCut} />
      </div>
      <AboutCard />
      <ToolTooltip />
      <Overlays ref={overlays} />
      <div ref={fade} className="pointer-events-none fixed inset-0 z-20 bg-bg-night opacity-0" />
      {/* The tall container that produces the master scroll progress. */}
      <div
        id={TRACK_ID}
        // Pointer events pass through to the canvas (signs are clickable).
        className="pointer-events-none relative"
        style={{ height: `${TRACK_VH}vh` }}
        aria-hidden
        data-holds={HOLDS.map((h) => `${h.start.toFixed(5)}-${h.end.toFixed(5)}`).join(",")}
      />
      <SmoothScroll trackId={TRACK_ID} onTick={onTick} />
      <Nav />
      <DebugOverlay />
    </>
  );
}
