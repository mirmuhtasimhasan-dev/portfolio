"use client";

import { useEffect, useRef, useState } from "react";
import { tick } from "@/lib/sound";
import { useReducedMotion } from "@/lib/media";

/** Stagger between neighbouring signs as a grid scrolls into view. */
const STAGGER_MS = 110;

/**
 * One shop sign in the phone tech-stack grid: the tool's logo as a neon tube
 * and its name. Dark until it scrolls into view, then it flickers on (2 or 3
 * times, after a short stagger by its place in the grid) and stays lit. A tap
 * makes it flicker again. Reduced motion: simply lit, no flicker.
 *
 * Level only nudges brightness: the least used tools stay at 75% of the most
 * used (1: 0.75, 2: 0.875, 3: 1).
 */
export function NeonSign({ name, logo, level, index }: { name: string; logo: string; level: 1 | 2 | 3; index: number }) {
  const reduced = useReducedMotion();
  const el = useRef<HTMLButtonElement>(null);
  const [seen, setSeen] = useState(false);
  // Bumped on every flicker, so the animation restarts (as a new element key).
  const [run, setRun] = useState(0);
  const [delay, setDelay] = useState(0);

  useEffect(() => {
    const node = el.current;
    if (!node || reduced) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setDelay(index * STAGGER_MS);
        setRun((r) => r + 1);
        setSeen(true);
        window.setTimeout(tick, index * STAGGER_MS);
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [index, reduced]);

  const lit = reduced || seen;
  const onTap = () => {
    if (reduced) return;
    setDelay(0);
    setRun((r) => r + 1);
    setSeen(true);
    tick();
  };
  // Two or three flickers, alternating through the grid.
  const flicker = run > 0 && !reduced ? (index % 2 === 0 ? "neon-flicker-3" : "neon-flicker-2") : "";
  const brightness = 0.75 + 0.125 * (level - 1);

  return (
    <button
      ref={el}
      type="button"
      onClick={onTap}
      aria-label={name}
      className={`flex h-full w-full flex-col items-center gap-2 rounded-sm border bg-bg-night px-2 py-3 transition-colors duration-300 ${
        lit ? "border-green/35" : "border-line-base"
      }`}
    >
      <span
        key={run}
        aria-hidden
        className={`flex flex-col items-center gap-2 ${flicker}`}
        style={{ opacity: lit ? brightness : 0.2, animationDelay: `${delay}ms` }}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-8 w-8 ${lit ? "text-green drop-shadow-[0_0_5px_rgb(34_197_94/0.85)]" : "text-green/60"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.75}
          strokeLinejoin="round"
        >
          <path d={logo} />
        </svg>
        <span
          className={`font-mono text-[11px] font-semibold leading-tight ${
            lit ? "text-[#f4f7f5] [text-shadow:0_0_6px_rgb(237_237_237/0.45)]" : "text-text-2"
          }`}
        >
          {name}
        </span>
      </span>
    </button>
  );
}
