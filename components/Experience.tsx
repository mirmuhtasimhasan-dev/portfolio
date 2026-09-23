"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";
import gsap from "gsap";
import { SmoothScroll } from "./SmoothScroll";
import { Overlays, type OverlaysHandle } from "./Overlays";
import { DebugOverlay } from "./DebugOverlay";
import { Nav } from "./Nav";
import { CredentialLabels } from "./CredentialLabels";
import { TRACK_ID } from "@/lib/sections";

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
      <CredentialLabels />
      <Overlays ref={overlays} />
      <div ref={fade} className="pointer-events-none fixed inset-0 z-20 bg-bg-night opacity-0" />
      {/* The tall container that produces the master scroll progress. */}
      <div id={TRACK_ID} className="relative h-[900vh]" aria-hidden />
      <SmoothScroll trackId={TRACK_ID} onTick={onTick} />
      <Nav />
      <DebugOverlay />
    </>
  );
}
