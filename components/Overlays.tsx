"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { scrollStore } from "@/lib/scrollStore";
import { sectionOpacity } from "@/lib/stopMap";

export type OverlaysHandle = { update: () => void };

// Phase 1 placeholders. Real content arrives in phase 2.
const PLACEHOLDER: Record<SectionId, { title: string; body: string; align: string }> = {
  hero: {
    title: "Hi. I'm Muhtasim.",
    body: "Full-stack developer. Mohammadpur, Dhaka.",
    align: "items-center justify-center text-center",
  },
  about: { title: "About", body: "Placeholder: lockdown, boredom, HTML.", align: "items-center justify-start" },
  credentials: {
    title: "Credentials",
    body: "Placeholder: three floors light up.",
    align: "items-center justify-end text-right",
  },
  toolset: {
    title: "Toolset",
    body: "Placeholder: the Neon Bazaar.",
    align: "items-end justify-center text-center pb-24",
  },
  projects: { title: "Projects", body: "Placeholder: Hatirjheel billboards.", align: "items-start justify-start pt-32" },
  contact: {
    title: "Say hello",
    body: "Placeholder: Sangsad Bhaban at dawn.",
    align: "items-center justify-center text-center",
  },
};

/**
 * Fixed layer with one panel per section. Opacity and offset are written
 * straight to the DOM from master progress every tick (no React re-render).
 */
export const Overlays = forwardRef<OverlaysHandle>(function Overlays(_, ref) {
  const panels = useRef<(HTMLElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    update() {
      const s = scrollStore.stop;
      panels.current.forEach((el, i) => {
        if (!el) return;
        const o = sectionOpacity(s, i);
        const y = Math.max(-1, Math.min(1, i - s)) * 40;
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        el.style.visibility = o < 0.002 ? "hidden" : "visible";
        el.style.pointerEvents = o > 0.6 ? "auto" : "none";
      });
    },
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {SECTIONS.map((sec, i) => {
        const p = PLACEHOLDER[sec.id];
        return (
          <section
            key={sec.id}
            ref={(el) => {
              panels.current[i] = el;
            }}
            aria-label={sec.label}
            className={`absolute inset-0 flex px-6 sm:px-16 ${p.align}`}
            style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? "visible" : "hidden" }}
          >
            <div className="max-w-xl">
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-green">
                {String(i + 1).padStart(2, "0")} / {sec.label}
              </p>
              <h2 className="text-4xl font-semibold tracking-tight text-text sm:text-6xl">{p.title}</h2>
              <p className="mt-4 text-base text-text-2 sm:text-lg">{p.body}</p>
            </div>
          </section>
        );
      })}
    </div>
  );
});
