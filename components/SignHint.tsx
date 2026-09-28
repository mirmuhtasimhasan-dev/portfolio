"use client";

import { useEffect, useRef } from "react";
import { bazaarStore } from "@/lib/bazaarStore";
import { scrollStore } from "@/lib/scrollStore";
import { inBazaar } from "@/lib/timeline";

/** "Click a sign to trace it to the work." pill; gone after the first click. */
export function SignHint() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id = 0;
    let o = 0;
    const loop = () => {
      const want = !bazaarStore.clicked && inBazaar(scrollStore.stop) ? 1 : 0;
      o += (want - o) * 0.12;
      if (el.current) {
        el.current.style.opacity = o.toFixed(3);
        el.current.style.visibility = o < 0.01 ? "hidden" : "visible";
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      ref={el}
      aria-hidden
      className="pointer-events-none fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-green/30 bg-bg-night/85 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-text-2"
      style={{ opacity: 0, visibility: "hidden" }}
    >
      Click a sign to trace it to the work.
    </div>
  );
}
