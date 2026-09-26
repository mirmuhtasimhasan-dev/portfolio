"use client";

import { toolTipEls } from "@/lib/labelStore";

/** "Used in" card above the hovered or selected sign; NeonBazaar positions it. */
export function ToolTooltip() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <div
        ref={(el) => {
          toolTipEls.root = el;
        }}
        className="absolute left-0 top-0 w-max max-w-[16rem] rounded-md border border-green/30 bg-bg-night/90 px-3 py-2 will-change-transform"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        <p
          ref={(el) => {
            toolTipEls.name = el;
          }}
          className="font-mono text-xs uppercase tracking-widest text-green"
        />
        <p
          ref={(el) => {
            toolTipEls.used = el;
          }}
          className="mt-0.5 text-sm text-text"
        />
      </div>
    </div>
  );
}
