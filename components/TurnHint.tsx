"use client";

import { sangsadTurn } from "@/lib/sangsadTurn";

/** "Drag to turn" pill under Sangsad Bhaban; SangsadBhaban positions and fades it. */
export function TurnHint() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <div
        ref={(el) => {
          sangsadTurn.hint = el;
        }}
        className="absolute left-0 top-0 flex w-max items-center gap-1.5 rounded-full border border-green/30 bg-bg-night/80 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-text-2 will-change-transform"
        style={{ opacity: 0, visibility: "hidden" }}
      >
        <span className="text-green">⟷</span> Drag to turn
      </div>
    </div>
  );
}
