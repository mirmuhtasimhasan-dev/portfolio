"use client";

import { ABOUT } from "@/lib/content";
import { aboutCardEls } from "@/lib/labelStore";

/**
 * The About text, attached to the last lit window by a thin green leader
 * line. AboutHouse places it beside the house each frame and reveals each
 * part from scroll progress, so it all reverses on scroll up.
 */
export function AboutCard() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <svg aria-hidden className="absolute inset-0 h-full w-full">
        <line
          ref={(el) => {
            aboutCardEls.leader = el;
          }}
          stroke="var(--color-green)"
          strokeWidth="1"
          strokeOpacity="0.85"
          visibility="hidden"
        />
        <circle
          ref={(el) => {
            aboutCardEls.dot = el;
          }}
          r="3"
          fill="var(--color-green)"
          visibility="hidden"
        />
      </svg>
      <div
        ref={(el) => {
          aboutCardEls.root = el;
        }}
        className="absolute left-0 top-0 w-[26rem] max-w-[calc(100vw-3rem)] rounded-md border border-green/25 bg-bg-night px-6 py-5 will-change-transform"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        <h2 className="sr-only">About</h2>
        <p aria-hidden className="font-mono text-lg text-window">
          <span
            ref={(el) => {
              aboutCardEls.code = el;
            }}
          />
          <span className="about-cursor ml-0.5 inline-block h-[1.1em] w-[0.55em] translate-y-[0.18em] bg-red" />
        </p>
        <p
          ref={(el) => {
            aboutCardEls.label = el;
          }}
          className="mt-5 font-mono text-[11px] uppercase tracking-[0.25em] text-text-2"
          style={{ opacity: 0 }}
        >
          2020 · lockdown
        </p>
        <p
          ref={(el) => {
            aboutCardEls.line1 = el;
          }}
          className="mt-2 text-xl leading-snug text-text"
          style={{ opacity: 0 }}
        >
          {ABOUT.lines[0]}
        </p>
        <p
          ref={(el) => {
            aboutCardEls.line2 = el;
          }}
          className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-green sm:text-4xl"
          style={{ opacity: 0 }}
        >
          {ABOUT.lines[1]}
        </p>
      </div>
    </div>
  );
}
