"use client";

import { useEffect, useRef, useState } from "react";
import { tick } from "@/lib/sound";

/**
 * One shop sign in the phone tech-stack grid: the tool's logo as a neon tube
 * and its name, dim until tapped. A tap makes it flicker on (straight on when
 * motion is reduced); tapping a lit sign turns it off again.
 */
export function NeonSign({ name, logo }: { name: string; logo: string }) {
  const [lit, setLit] = useState(false);
  const [flicker, setFlicker] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onTap = () => {
    window.clearTimeout(timer.current);
    if (lit) {
      setLit(false);
      setFlicker(false);
      return;
    }
    setLit(true);
    tick();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFlicker(true);
    timer.current = window.setTimeout(() => {
      tick();
      setFlicker(false);
    }, 700);
  };

  return (
    <button
      type="button"
      aria-pressed={lit}
      onClick={onTap}
      className={`neon-sign group flex h-full w-full flex-col items-center gap-2 rounded-sm border bg-bg-night px-2 py-3 transition-colors ${
        lit ? "border-green shadow-[0_0_16px_rgb(34_197_94/0.3)]" : "border-line-base"
      } ${flicker ? "neon-flicker" : ""}`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className={`h-8 w-8 ${lit ? "text-green drop-shadow-[0_0_4px_rgb(34_197_94/0.9)]" : "text-green/40"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.7}
        strokeLinejoin="round"
      >
        <path d={logo} />
      </svg>
      <span
        className={`font-mono text-[11px] font-semibold leading-tight ${
          lit ? "text-text [text-shadow:0_0_6px_rgb(237_237_237/0.6)]" : "text-text-2/70"
        }`}
      >
        {name}
      </span>
    </button>
  );
}
