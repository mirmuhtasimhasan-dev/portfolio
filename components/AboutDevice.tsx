"use client";

import { useEffect, useRef } from "react";
import PillNav from "./PillNav";

/* ------------------------------------------------------------------
   §5 · The About device.

   The lid is DOM rather than a texture. It used to be a WebGL quad
   sampling a 2400x1500 capture of the About card, which meant the copy
   inside it was a picture of copy — it could not hold a cursor light,
   and every edit to the words needed a new screenshot. Now the real
   card sits on the lid, so the mesh, the veil and the blob that follows
   the pointer are the card's own and cost nothing extra here.

   That rules out transform-style: preserve-3d — a canvas inside a
   preserve-3d subtree renders but never composites (globals.css §11b) —
   so the depth is one flattening rotateX on the lid, with the card
   keeping its own depth inside it.

   The rotation is scrubbed to scroll position, but the value the
   transform is built from is carried there by LivingCard's spring, not
   written straight from the scroll offset: same 1/60 step, same 0.14
   and 0.5 constants, so the lid opens with the hand the card moves with
   and a flicked wheel does not snap it.
   ------------------------------------------------------------------ */

/** §8 — smootherstep: zeroes the second derivative as well as the first. */
function smootherstep(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * c * (c * (6 * c - 15) + 10);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

type Mode = {
  /** degrees the lid leans back at rest */
  tilt: number;
  /** scale it opens from */
  scale: number;
  /** px it rises through — the narrow fade-up, zero when it is a lid */
  lift: number;
  /** fraction of the pin the opening takes; the rest is spent upright */
  open: number;
  /** how far into shadow it leans, matching the old shader's 0.22 falloff */
  dim: number;
};

const WIDE: Mode = { tilt: 26, scale: 0.88, lift: 0, open: 0.55, dim: 0.18 };

/* No pin and no lid on a phone: the stage is in flow there (globals.css
   §11), so this is a light tilt under a fade-up, over half a viewport. */
const NARROW: Mode = { tilt: 8, scale: 1, lift: 26, open: 1, dim: 0.08 };

export default function AboutDevice({
  children,
}: {
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lidRef = useRef<HTMLDivElement>(null);
  const bezelRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const lid = lidRef.current;
    const bezel = bezelRef.current;
    const sweep = sweepRef.current;
    const dim = dimRef.current;
    const navEl = navRef.current;
    if (!track || !stage || !lid || !bezel || !sweep || !dim || !navEl) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    /* Kept in sync with the 720px breakpoint in globals.css §15 — the stage
       leaves the flow on one side of it and pins on the other, so the motion
       has to change mode with the layout, not just with the first match. */
    const narrowMq = window.matchMedia("(max-width: 720px)");
    let mode: Mode = narrowMq.matches ? NARROW : WIDE;

    let p = 0; // scroll progress through the track, 0 … 1
    let e = 0; // what the transform is built from — the spring's position
    let ve = 0;

    let acc = 0;
    let last = 0;
    let raf = 0;
    let running = false;
    let onScreen = false;
    let disposed = false;

    /* Every write is guarded: a transform string or a gradient position that
       has not changed is a repaint the compositor did not need. */
    let lastTransform = "";
    let lastOpacity = "";
    let lastSweep = -999;
    let lastDim = -1;
    let lastEdge = -9999;
    let lastNav = -1;

    /* Read first, write second. The frame takes every measurement it needs up
       front so it never interleaves layout reads with style writes — the card
       inside runs its own loop, and reading after it has written is what turns
       two cheap frames into one forced synchronous layout. */
    let trackTop = 0;
    let trackH = 0;
    let edgeY = 0;

    function measure() {
      const r = track!.getBoundingClientRect();
      trackTop = r.top;
      trackH = r.height;
      if (mode === WIDE) {
        edgeY =
          bezel!.getBoundingClientRect().top -
          stage!.getBoundingClientRect().top;
      }
    }

    function progress(): number {
      const vh = window.innerHeight;
      if (mode === NARROW) {
        /* in flow, so this is an entrance: it starts as the top edge clears
           the fold and finishes half a viewport later */
        return clamp01((vh * 0.92 - trackTop) / (vh * 0.55));
      }
      const travel = trackH - vh; // the pinned distance
      if (travel <= 0) return 1;
      return clamp01(-trackTop / travel);
    }

    /* LivingCard's spring, constant for constant: taken just past critical
       damping so it glides in and stops rather than ringing, at a fixed 1/60
       step so the settle feels the same at 60Hz and 144Hz. */
    const STEP = 1000 / 60;

    function advance() {
      const target = smootherstep(p / mode.open);
      ve += (target - e) * 0.14;
      ve *= 0.5;
      e += ve;
    }

    function paint() {
      const back = 1 - e; // 1 leaning away, 0 upright
      const settled = back < 0.0015 && Math.abs(ve) < 0.0008;

      /* Upright, the transform comes off entirely rather than resting at
         rotateX(0deg): a 3D transform rasterises the subtree once and samples
         it, and this is a card of body copy — it should be laid out on the
         pixel grid the moment it stops moving. */
      const transform = settled
        ? ""
        : mode === NARROW
          ? `translate3d(0, ${(mode.lift * back).toFixed(2)}px, 0) rotateX(${(
              mode.tilt * back
            ).toFixed(3)}deg)`
          : `rotateX(${(mode.tilt * back).toFixed(3)}deg) scale(${(
              1 -
              (1 - mode.scale) * back
            ).toFixed(4)})`;

      if (transform !== lastTransform) {
        lastTransform = transform;
        lid!.style.transform = transform;
        lid!.style.willChange = settled ? "auto" : "transform";
      }

      const opacity =
        mode === NARROW && !settled ? (0.2 + 0.8 * e).toFixed(2) : "";
      if (opacity !== lastOpacity) {
        lastOpacity = opacity;
        lid!.style.opacity = opacity;
      }

      /* The specular band travels as the lid opens, the way the sweep did in
         the shader. Moved, never redrawn: the gradient is fixed and only its
         transform changes, so this stays on the compositor. */
      const x = Math.round(back * 460) / 10 - 16;
      if (x !== lastSweep) {
        lastSweep = x;
        sweep!.style.transform = `translate3d(${x}%, 0, 0)`;
      }

      const d = Math.round(back * mode.dim * 100) / 100;
      if (d !== lastDim) {
        lastDim = d;
        dim!.style.opacity = String(d);
      }
    }

    /* The pill rides the lid's projected top edge. It is not inside the lid —
       it would lean with it — so it takes the edge's measured position and
       stays flat against the stage. */
    function placeNav() {
      if (mode === NARROW) return; // hidden at that width, so do not measure it
      const px = Math.round(edgeY * 2) / 2;
      if (px !== lastEdge) {
        lastEdge = px;
        navEl!.style.setProperty("--edge-y", String(px));
      }
      const o = reduced
        ? 1
        : Math.round(smootherstep(p * 6) * smootherstep((1 - p) * 6) * 50) / 50;
      if (o !== lastNav) {
        lastNav = o;
        navEl!.style.opacity = String(o);
        navEl!.style.pointerEvents = o < 0.05 ? "none" : "";
      }
    }

    function frame(now: number) {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(50, now - last);
      last = now;

      measure();
      p = progress();

      acc = Math.min(acc + dt, 200);
      while (acc >= STEP) {
        advance();
        acc -= STEP;
      }

      paint();
      placeNav();
    }

    function start() {
      if (running || disposed || reduced || !onScreen || document.hidden) return;
      running = true;
      last = performance.now(); // §8 — reset the delta clock on resume
      acc = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    /** Reduced motion, and the state to fall back to on a mode change. */
    function paintOnce() {
      measure();
      p = progress();
      e = reduced ? 1 : smootherstep(p / mode.open);
      ve = 0;
      paint();
      placeNav();
    }

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(track);

    /* The card changes height when the copy reflows, which moves the edge the
       pill is holding — a window listener never hears about that. */
    const ro = new ResizeObserver(() => {
      if (!running) paintOnce();
    });
    ro.observe(bezel);

    function onModeChange() {
      mode = narrowMq.matches ? NARROW : WIDE;
      lastTransform = lastOpacity = "";
      lastSweep = -999;
      lastDim = lastEdge = lastNav = -1;
      lid!.style.opacity = "";
      paintOnce();
    }

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    narrowMq.addEventListener("change", onModeChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", paintOnce);

    paintOnce();
    start();

    return () => {
      disposed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      narrowMq.removeEventListener("change", onModeChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", paintOnce);
    };
  }, []);

  return (
    <div className="device" ref={trackRef}>
      <div className="device-stage" ref={stageRef}>
        <div className="device-lid" ref={lidRef}>
          <div className="device-bezel" ref={bezelRef}>
            <div className="device-sweep" ref={sweepRef} aria-hidden="true" />
            {children}
          </div>
          <div className="device-dim" ref={dimRef} aria-hidden="true" />
        </div>

        <div className="nav-floating" ref={navRef}>
          <PillNav decorative />
        </div>
      </div>
    </div>
  );
}