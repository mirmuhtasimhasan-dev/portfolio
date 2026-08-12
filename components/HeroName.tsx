"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------
   §9 · The hero name, lit by the cursor.

   Two effects on one loop. A gradient the size of a coin follows the
   pointer and colours whatever letters it crosses; the letters near
   the pointer lift and swell. Both are scrubbed to the same pointer
   and damped, so the name reads as a surface being touched rather
   than as a row of things reacting.

   Nothing here reads layout inside the loop except one rect for the
   container — the letters' own positions are cached, and cached from
   offsetLeft rather than getBoundingClientRect precisely because
   offsets are layout values that a transform cannot disturb. Reading
   bounding boxes would mean measuring letters mid-bulge and feeding
   the wave its own output.

   The default state is the name exactly as it was: the gradient is
   only attached under a data-lit the script sets, and only inside an
   @supports that both background-clip and color-mix have to pass.
   No pointer, reduced motion, no JS or an old engine all land on
   solid --ink.
   ------------------------------------------------------------------ */

/* The lit circle's radius lives in globals.css §9 with the gradient it
   belongs to — the loop only moves the centre, so keeping a copy here would
   be two sources of truth for one number. */

/** how far from a letter's centre the bulge still reaches, px */
const REACH = 110;
/** how far a fully bulged letter rises, px */
const LIFT = 10;
/** how much it swells on top of 1 */
const SWELL = 0.18;
/** per-frame damping — the gradient trails the pointer */
const EASE_POINTER = 0.15;
/** per-frame damping — each letter trails its own target */
const EASE_LETTER = 0.18;
/** where the gradient drifts to when the pointer leaves, px below the name */
const DRIFT = 420;

/** §8 — the smoothstep the brief asks for: soft at both ends of the wave. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export default function HeroName({ text }: { text: string }) {
  const rootRef = useRef<HTMLHeadingElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const letters = letterRefs.current.filter(
      (el): el is HTMLSpanElement => el !== null,
    );
    if (!letters.length) return;

    /* A pointer that cannot hover has nothing to follow, and reduced motion
       asked for none of this. Either way the name is left alone — no
       data-lit, so it keeps the colour it has always had. */
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const canHover = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    if (reduced || !canHover) return;

    /* The pointer is tracked across the whole hero, not just the glyphs —
       proximity is the effect, so the name should answer an approach. */
    const hero = root.closest(".hero") ?? root;

    let disposed = false;
    let raf = 0;
    let running = false;
    let onScreen = true;
    let active = false; // is the pointer in the hero

    /* Cached geometry. Letter centres are relative to the name's own box. */
    let centres: number[] = [];
    let boxH = 0;

    let px = 0; // pointer, in the name's coordinates
    let py = 0;
    let gx = -999; // the lit circle, damped
    let gy = -999;

    const now = new Float32Array(letters.length); // each letter's bulge, 0…1
    const lastTransform: string[] = new Array(letters.length).fill("");
    let lastGx = NaN;
    let lastGy = NaN;

    /* Reads first, writes second — every offset is collected before a single
       custom property goes out, so this never interleaves the two. */
    function measure() {
      const w = root!.offsetWidth;
      const h = root!.offsetHeight;
      const lefts = letters.map((l) => l.offsetLeft);
      const widths = letters.map((l) => l.offsetWidth);
      const tops = letters.map((l) => l.offsetTop);

      boxH = h;
      centres = lefts.map((l, i) => l + widths[i] / 2);

      root!.style.setProperty("--w", `${w}px`);
      root!.style.setProperty("--h", `${h}px`);
      /* Each letter carries where it sits inside the name, so one shared
         --gx/--gy resolves to the same circle in every letter's own box. */
      letters.forEach((l, i) => {
        l.style.setProperty("--ox", `${lefts[i]}px`);
        l.style.setProperty("--oy", `${tops[i]}px`);
      });
    }

    function frame() {
      if (disposed) return;
      raf = requestAnimationFrame(frame);

      /* The only layout read in the loop, and it happens before any write:
         the name moves under the pointer as the page scrolls. */
      const r = root!.getBoundingClientRect();
      const targetX = px - r.left;
      const targetY = active ? py - r.top : boxH + DRIFT;

      gx += (targetX - gx) * EASE_POINTER;
      gy += (targetY - gy) * EASE_POINTER;

      /* Quantised: a fresh fractional value every frame repaints the gradient
         for no visible gain. */
      const qx = Math.round(gx * 2) / 2;
      const qy = Math.round(gy * 2) / 2;
      if (qx !== lastGx || qy !== lastGy) {
        lastGx = qx;
        lastGy = qy;
        root!.style.setProperty("--gx", `${qx}px`);
        root!.style.setProperty("--gy", `${qy}px`);
      }

      let settled = !active && gy > boxH + DRIFT - 1;

      for (let i = 0; i < letters.length; i++) {
        /* The bulge follows the pointer itself rather than the damped circle,
           and gets its softness from its own damping — so the wave leads the
           colour by a hair instead of the two moving as one rigid thing. */
        const d = Math.abs(targetX - centres[i]);
        const t = d >= REACH ? 0 : 1 - d / REACH;
        const target = active ? smoothstep(t) : 0;

        now[i] += (target - now[i]) * EASE_LETTER;
        if (now[i] > 0.0015) settled = false;

        const v =
          now[i] < 0.0015
            ? ""
            : `translateY(${(-LIFT * now[i]).toFixed(2)}px) scale(${(
                1 +
                SWELL * now[i]
              ).toFixed(4)})`;
        if (v !== lastTransform[i]) {
          lastTransform[i] = v;
          letters[i].style.transform = v;
        }
      }

      /* Nothing left to move: the gradient has drifted away and every letter
         is back down. Park the loop until the pointer returns. */
      if (settled) stop();
    }

    function start() {
      if (running || disposed || !onScreen || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function onMove(e: PointerEvent) {
      px = e.clientX;
      py = e.clientY;
      active = true;
      start();
    }

    function onLeave() {
      /* Not a snap back: the target goes off the bottom of the name and the
         same damping carries the circle down and out. */
      active = false;
      start();
    }

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(root);

    /* The name is set in a clamp() on vw and in a webfont that swaps in after
       first paint — both move the letters, and neither fires a resize. */
    const ro = new ResizeObserver(measure);
    ro.observe(root);

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    measure();
    root.dataset.lit = "";

    document.fonts?.ready.then(() => {
      if (!disposed) measure();
    });

    hero.addEventListener("pointermove", onMove as EventListener, {
      passive: true,
    });
    hero.addEventListener("pointerleave", onLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      hero.removeEventListener("pointermove", onMove as EventListener);
      hero.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      delete root.dataset.lit;
      letters.forEach((l) => {
        l.style.transform = "";
      });
    };
  }, [text]);

  /* One span per character, spaces held open with a non-breaking space so the
     name keeps the single line it has at every width. The whole string is on
     aria-label and every glyph is hidden, so it is announced once, as itself. */
  return (
    <h1 className="hero-name" ref={rootRef} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span
          className="hn-l"
          key={`${ch}-${i}`}
          aria-hidden="true"
          ref={(el) => {
            letterRefs.current[i] = el;
          }}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </h1>
  );
}