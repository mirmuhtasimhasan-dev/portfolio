"use client";

import { useEffect, useRef, useState } from "react";
import { SECTIONS } from "@/lib/sections";
import { scrollStore } from "@/lib/scrollStore";
import { ZONES } from "@/lib/stopMap";

/** Toggle with the "D" key (or open with ?debug in the URL). */
export function DebugOverlay() {
  const [open, setOpen] = useState(false);
  const text = useRef<HTMLPreElement>(null);
  const marker = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "d" || e.key === "D") setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    if (new URLSearchParams(window.location.search).has("debug")) {
      // Defer so the state update is not synchronous inside the effect.
      queueMicrotask(() => setOpen(true));
    }
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    let id = 0;
    const loop = () => {
      const { progress, stop, section, fps, reducedMotion } = scrollStore;
      const zone =
        ZONES.find((z) => progress >= z.start && progress <= z.end) ?? ZONES[ZONES.length - 1];
      if (text.current) {
        text.current.textContent =
          `progress  ${progress.toFixed(4)}\n` +
          `stop      ${stop.toFixed(3)}\n` +
          `section   ${section + 1} ${SECTIONS[section].label}\n` +
          `zone      ${zone.kind}${zone.kind === "travel" ? ` ${zone.index + 1}->${zone.index + 2}` : ""}\n` +
          `fps       ${fps.toFixed(0)}` +
          (reducedMotion ? "\nreduced motion" : "");
      }
      if (marker.current) marker.current.style.left = `${progress * 100}%`;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed right-3 top-3 z-50 w-64 rounded-md border border-green/30 bg-bg-night/85 p-3 font-mono text-[11px] leading-5 text-text shadow-lg backdrop-blur">
      <pre ref={text} className="whitespace-pre" />
      <div className="relative mt-2 h-2 w-full overflow-hidden rounded-sm bg-line-base">
        {ZONES.filter((z) => z.kind === "hold").map((z) => (
          <div
            key={z.index}
            className="absolute inset-y-0 bg-green/50"
            style={{ left: `${z.start * 100}%`, width: `${(z.end - z.start) * 100}%` }}
          />
        ))}
        <div ref={marker} className="absolute inset-y-0 w-0.5 bg-text" />
      </div>
      <p className="mt-2 text-text-2">green = hold zones · D to hide</p>
    </div>
  );
}
