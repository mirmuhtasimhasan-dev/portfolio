"use client";

import { aboutScreenEls } from "@/lib/labelStore";

/**
 * The screen inside the last lit window. AboutHouse positions it beside the
 * window and types the snippet from scroll progress.
 */
export function AboutScreen() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <div
        ref={(el) => {
          aboutScreenEls.root = el;
        }}
        className="absolute left-0 top-0 w-max rounded-md border border-window/25 bg-bg-night/90 px-4 py-3 shadow-[0_0_40px_rgb(245_230_200/0.12)] will-change-transform"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-text-2">index.html</p>
        <p className="font-mono text-lg text-window">
          <span
            ref={(el) => {
              aboutScreenEls.code = el;
            }}
          />
          <span className="about-cursor ml-0.5 inline-block h-[1.1em] w-[0.55em] translate-y-[0.18em] bg-red" />
        </p>
      </div>
    </div>
  );
}
