"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";
import gsap from "gsap";
import { SmoothScroll } from "./SmoothScroll";
import { Overlays, type OverlaysHandle } from "./Overlays";
import { DebugOverlay } from "./DebugOverlay";
import { Nav } from "./Nav";
import { ProjectPanel } from "./ProjectPanel";
import { TurnHint } from "./TurnHint";
import { projectStore } from "@/lib/projectStore";
import { scrollStore } from "@/lib/scrollStore";
import { PROJECT_SECTIONS } from "@/lib/sections";
import { AboutCard } from "./AboutCard";
import { TRACK_ID, TRACK_VH } from "@/lib/sections";
import { SignHint } from "./SignHint";
import { HOLDS } from "@/lib/stopMap";
import { usePhoneMode } from "@/lib/media";

// Text first; the WebGL canvas loads after, client only.
const Scene = dynamic(() => import("./scene/Scene"), { ssr: false });
// Phone mode: normal scrolling sections over a light background canvas.
const PhoneSite = dynamic(() => import("./phone/PhoneSite"), { ssr: false });

/** Desktop fly-through, or the phone version (touch device or under 900 px). */
export function Experience() {
  const phone = usePhoneMode();
  return phone ? <PhoneSite /> : <DesktopExperience />;
}

function DesktopExperience() {
  const overlays = useRef<OverlaysHandle>(null);
  const fade = useRef<HTMLDivElement>(null);

  const onTick = useCallback(() => {
    overlays.current?.update();
    // Leaving the bridge closes an open project panel.
    if (projectStore.getOpen() && !PROJECT_SECTIONS.includes(scrollStore.section)) projectStore.setOpen(null);
  }, []);

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
      <SignHint />
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
      <ProjectPanel />
      <TurnHint />
      <DebugOverlay />
    </>
  );
}
