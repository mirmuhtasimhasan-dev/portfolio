"use client";

import { ABOUT } from "@/lib/content";
import { aboutCardEls } from "@/lib/labelStore";

const Cursor = ({ refKey }: { refKey: "cursor1" | "cursor2" }) => (
  <span
    ref={(el) => {
      aboutCardEls[refKey] = el;
    }}
    aria-hidden
    className="about-cursor ml-1 inline-block h-[0.95em] w-[0.5em] translate-y-[0.12em] bg-red"
  />
);

/** Faint editor line number. */
const Ln = ({ n }: { n: number }) => (
  <span aria-hidden className="select-none pt-[0.2em] text-right font-mono text-[11px] leading-[1.6] text-text-2/35">
    {n}
  </span>
);

/**
 * The About text as a small code editor, attached to the last lit window by
 * a thin green leader line. AboutHouse places it beside the house each frame
 * and reveals each part from scroll progress, so it all reverses on scroll up.
 */
export function AboutCard() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <svg aria-hidden className="absolute inset-0 h-full w-full">
        {/* Solid background band under the leader: no city line crosses it. */}
        <line
          ref={(el) => {
            aboutCardEls.leaderPad = el;
          }}
          stroke="var(--color-bg-night)"
          strokeWidth="5"
          strokeLinecap="round"
          visibility="hidden"
        />
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
        {/* A small light travelling from the window to the card, on a loop. */}
        <circle
          ref={(el) => {
            aboutCardEls.spark = el;
          }}
          r="2.2"
          fill="var(--color-window)"
          visibility="hidden"
          style={{ filter: "drop-shadow(0 0 4px rgb(245 230 200 / 0.9))" }}
        />
      </svg>
      <div
        ref={(el) => {
          aboutCardEls.root = el;
        }}
        className="absolute left-0 top-0 w-[27rem] max-w-[calc(100vw-3rem)] overflow-hidden rounded-md border border-green/25 bg-bg-night will-change-transform"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        <h2 className="sr-only">About</h2>
        {/* Editor top bar */}
        <div aria-hidden className="flex items-center gap-1.5 border-b border-green/15 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-text-2/30" />
          <span className="h-2 w-2 rounded-full bg-text-2/30" />
          <span className="h-2 w-2 rounded-full bg-text-2/30" />
          <span className="ml-3 font-mono text-[11px] tracking-wide text-text-2">index.html</span>
        </div>
        {/* Body: line numbers + content */}
        <div className="grid grid-cols-[1.25rem_1fr] gap-x-4 px-5 pb-5 pt-4">
          <Ln n={1} />
          <p
            ref={(el) => {
              aboutCardEls.codeRow = el;
            }}
            aria-hidden
            className="font-mono text-lg leading-[1.6] text-window"
          >
            <span
              ref={(el) => {
                aboutCardEls.code = el;
              }}
            />
            <Cursor refKey="cursor1" />
          </p>

          <Ln n={2} />
          <p
            ref={(el) => {
              aboutCardEls.label = el;
            }}
            className="mt-3 font-mono text-[11px] uppercase leading-[1.6] tracking-[0.25em] text-text-2"
            style={{ opacity: 0 }}
          >
            2020 · lockdown
          </p>

          <Ln n={3} />
          <p
            ref={(el) => {
              aboutCardEls.line1 = el;
            }}
            className="mt-1 text-xl leading-snug text-text"
            style={{ opacity: 0 }}
          >
            {ABOUT.lines[0]}
          </p>

          <Ln n={4} />
          <p
            ref={(el) => {
              aboutCardEls.line2 = el;
            }}
            className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-green sm:text-4xl"
            style={{ opacity: 0 }}
          >
            {ABOUT.lines[1]}
            <Cursor refKey="cursor2" />
          </p>
        </div>
      </div>
    </div>
  );
}
