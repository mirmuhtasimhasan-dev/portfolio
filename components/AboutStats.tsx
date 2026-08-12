"use client";

import { useEffect, useRef } from "react";
import type { Stat } from "@/lib/content";

/* ------------------------------------------------------------------
   §11c · The About card's footer figures.

   The numbers run up from zero the first time the card is seen, and
   only that once. The suffix is a sibling of the animating span, not
   part of it — a per cent sign has no business being interpolated.

   Server-rendered at their final values, which is what makes every
   fallback here free: no JavaScript, reduced motion, or an observer
   that never fires all leave the real numbers on the page. The zero
   is written by the script, and only when the script intends to
   count away from it.
   ------------------------------------------------------------------ */

const DURATION = 1100;

/** Ease-out cubic: fast off the mark, and it lands rather than stops. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function AboutStats({ items }: { items: Stat[] }) {
  const rootRef = useRef<HTMLUListElement>(null);
  const numRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nums = numRefs.current.filter(
      (el): el is HTMLSpanElement => el !== null,
    );
    if (!nums.length) return;

    /* Reduced motion keeps the rendered values — there is nothing to skip to,
       they are already right. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = items.map((s) => s.value);
    const last = new Array(nums.length).fill(-1);
    nums.forEach((n) => {
      n.textContent = "0";
    });

    let raf = 0;
    let started = 0;
    let disposed = false;

    function frame(now: number) {
      if (disposed) return;
      if (!started) started = now;
      const t = Math.min(1, (now - started) / DURATION);
      const e = easeOutCubic(t);
      for (let i = 0; i < nums.length; i++) {
        const v = Math.round(targets[i] * e);
        /* 100 counts through a hundred values and 2 through three; writing
           only on change keeps the small ones from churning the DOM. */
        if (v !== last[i]) {
          last[i] = v;
          nums[i].textContent = String(v);
        }
      }
      if (t < 1) raf = requestAnimationFrame(frame);
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect(); // once, and never again
        raf = requestAnimationFrame(frame);
      },
      { threshold: 0.35 },
    );
    io.observe(root);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [items]);

  return (
    <ul className="about-stats" ref={rootRef}>
      {items.map((stat, i) => (
        /* The whole figure is named on the item and its parts are hidden, so
           a screen reader is told "5+ years coding" once rather than reading
           a number that is in the middle of changing. */
        <li
          className="about-stat"
          key={stat.label}
          aria-label={`${stat.value}${stat.suffix} ${stat.label}`}
        >
          <p className="about-stat-value" aria-hidden="true">
            <span
              ref={(el) => {
                numRefs.current[i] = el;
              }}
            >
              {stat.value}
            </span>
            {stat.suffix}
          </p>
          <p className="about-stat-label mono" aria-hidden="true">
            {stat.label}
          </p>
        </li>
      ))}
    </ul>
  );
}