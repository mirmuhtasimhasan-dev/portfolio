"use client";

import { useEffect, useRef } from "react";
import type { Project } from "@/lib/content";
import ProjectTitle, { type ProjectTitleHandle } from "./ProjectTitle";
import LensHeading from "./LensHeading";

/* ------------------------------------------------------------------
   §6 · Projects — a horizontal showcase on a vertical scroll.

   The section pins and the rail slides sideways, one project at a
   time, scrubbed to scroll position rather than clicked through.

   The value the rail is translated by is carried there by the same
   spring the About lid opens with — 0.14 and 0.5 on a fixed 1/60
   step — so a flicked wheel arrives rather than snaps, and the two
   sections move with one hand.

   Each segment is smootherstepped before the spring sees it, which
   gives every project a dwell at its own index. That is the part
   scroll-snap gets wrong: snapping fights the wheel, an eased
   segment just makes the middle of the travel faster than the ends.

   The rail is an enhancement, not the layout. Default CSS stacks the
   projects and scrolls normally; this adds data-mode="rail" only
   where it can drive it, so no-JS, reduced motion and narrow screens
   all land on the stacked version rather than on a clipped rail with
   one project showing.
   ------------------------------------------------------------------ */

/** §8 — smootherstep: zeroes the second derivative as well as the first. */
function smootherstep(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * c * (c * (6 * c - 15) + 10);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** The chrome shows where the shot came from, not the whole query string. */
function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

export default function ProjectShowcase({
  eyebrow,
  heading,
  items,
}: {
  eyebrow: string;
  heading: string;
  items: Project[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const previewRefs = useRef<(HTMLElement | null)[]>([]);
  const titleRefs = useRef<(ProjectTitleHandle | null)[]>([]);

  useEffect(() => {
    const track = trackRef.current;
    const rail = railRef.current;
    const bar = barRef.current;
    const now = nowRef.current;
    if (!track || !rail || !bar || !now) return;

    const count = items.length;
    /* One project is not a carousel — leave it stacked and skip the loop. */
    if (count < 2) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    /* Two limits, both of them real, and both measured rather than guessed.
       Width: under 1000px the copy column is ~380px, which wraps What onto
       enough lines to outgrow any viewport the rail would fit in. Height: a
       pinned slide cannot be scrolled, so a screen too short to hold one just
       cuts the Visit link off the bottom. Under either, the stacked layout
       takes over — it is allowed to be as tall as it likes. */
    const wideMq = window.matchMedia(
      "(min-width: 1000px) and (min-height: 680px)",
    );

    let railing = false;
    let p = 0; // scroll progress through the track, 0 … 1
    let e = 0; // what the rail is translated by — the spring's position
    let ve = 0;

    let acc = 0;
    let last = 0;
    let raf = 0;
    let running = false;
    let onScreen = false;
    let disposed = false;

    /* Every write is guarded: a transform string that has not changed is a
       repaint nothing asked for. */
    let lastRail = "";
    let lastBar = "";
    let lastIndex = -1;
    const lastSlide: string[] = [];
    const lastPreview: string[] = [];

    let trackTop = 0;
    let trackH = 0;

    const STEP = 1000 / 60;

    function measure() {
      const r = track!.getBoundingClientRect();
      trackTop = r.top;
      trackH = r.height;
    }

    function progress(): number {
      const travel = trackH - window.innerHeight; // the pinned distance
      if (travel <= 0) return 0;
      return clamp01(-trackTop / travel);
    }

    /* LivingCard's spring, constant for constant, at a fixed 1/60 step so the
       settle feels the same at 60Hz and 144Hz. */
    function advance() {
      const raw = p * (count - 1);
      const i = Math.min(count - 2, Math.floor(raw));
      const target = i + smootherstep(raw - i);
      ve += (target - e) * 0.14;
      ve *= 0.5;
      e += ve;
    }

    function paint() {
      /* The rail is one viewport wide and the slides overflow it, so one
         whole slide is exactly 100% — no measuring, and it survives a resize
         mid-scroll without recomputing anything. */
      const t = `translate3d(${(-e * 100).toFixed(3)}%, 0, 0)`;
      if (t !== lastRail) {
        lastRail = t;
        rail!.style.transform = t;
      }

      const b = `scaleX(${(e / (count - 1)).toFixed(4)})`;
      if (b !== lastBar) {
        lastBar = b;
        bar!.style.transform = b;
      }

      const index = Math.round(e);
      if (index !== lastIndex) {
        lastIndex = index;
        now!.textContent = pad2(index + 1);
        /* The arriving title decodes itself. The first paint counts as an
           arrival too, so slide one decodes on the way in. */
        titleRefs.current[index]?.decode();
        /* Off-slide links are clipped out of sight, and a transformed rail
           does not scroll to a focused child the way an overflow container
           would — so a tab into one would put the focus ring somewhere the
           eye cannot follow. They come back the moment their slide does. */
        slideRefs.current.forEach((el, i) => {
          el?.toggleAttribute("inert", i !== index);
        });
      }

      for (let i = 0; i < count; i++) {
        const d = i - e; // signed distance from the slide that is current
        const a = Math.abs(d);

        const slide = slideRefs.current[i];
        if (slide) {
          const o = a >= 1 ? "0.18" : (1 - a * 0.82).toFixed(3);
          if (o !== lastSlide[i]) {
            lastSlide[i] = o;
            slide.style.opacity = o;
          }
        }

        /* A shallow turn away from the reader as it leaves, in the same
           language as the About lid — and off entirely at rest, so the shot
           is sampled on the pixel grid rather than through a 3D transform. */
        const preview = previewRefs.current[i];
        if (preview) {
          const pt =
            a < 0.002
              ? ""
              : `perspective(1400px) rotateY(${(d * -7).toFixed(2)}deg) scale(${(
                  1 -
                  Math.min(1, a) * 0.06
                ).toFixed(4)})`;
          if (pt !== lastPreview[i]) {
            lastPreview[i] = pt;
            preview.style.transform = pt;
          }
        }
      }
    }

    function frame(nowMs: number) {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(50, nowMs - last);
      last = nowMs;

      measure();
      p = progress();

      acc = Math.min(acc + dt, 200);
      while (acc >= STEP) {
        advance();
        acc -= STEP;
      }

      paint();
    }

    function start() {
      if (running || disposed || !railing || !onScreen || document.hidden)
        return;
      running = true;
      last = performance.now(); // §8 — reset the delta clock on resume
      acc = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    /** Hand every inline style back, so the stacked layout is pure CSS. */
    function clearInline() {
      rail!.style.transform = "";
      bar!.style.transform = "";
      now!.textContent = "01";
      slideRefs.current.forEach((el) => {
        if (!el) return;
        el.style.opacity = "";
        el.removeAttribute("inert");
      });
      previewRefs.current.forEach((el) => {
        if (el) el.style.transform = "";
      });
      lastRail = lastBar = "";
      lastIndex = -1;
      lastSlide.length = 0;
      lastPreview.length = 0;
    }

    function apply() {
      const next = wideMq.matches && !reduced;
      if (next === railing) return;
      railing = next;
      if (railing) {
        track!.dataset.mode = "rail";
        e = 0;
        ve = 0;
        measure();
        p = progress();
        e = p * (count - 1); // land where the scroll already is
        paint();
        start();
      } else {
        stop();
        delete track!.dataset.mode;
        clearInline();
      }
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

    /* The stacked entrance. Runs in both modes but only styles anything in
       the stacked one, so switching modes never leaves a slide mid-fade. */
    const enterIO = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          /* Stacked, there is no slide change to decode on — arriving in
             the viewport is the arrival. Skipped while the rail is on,
             where paint() already decodes on the index. */
          if (!railing) {
            const at = slideRefs.current.indexOf(entry.target as HTMLElement);
            if (at !== -1) titleRefs.current[at]?.decode();
          }
          enterIO.unobserve(entry.target); // it only ever arrives once
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0 },
    );
    slideRefs.current.forEach((el) => el && enterIO.observe(el));
    track.dataset.enter = "";

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    wideMq.addEventListener("change", apply);
    document.addEventListener("visibilitychange", onVisibility);

    apply();

    return () => {
      disposed = true;
      stop();
      io.disconnect();
      enterIO.disconnect();
      wideMq.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [items.length]);

  return (
    <div
      className="hshow"
      ref={trackRef}
      style={{ "--slides": items.length } as React.CSSProperties}
    >
      <div className="hshow-stage" ref={stageRef}>
        <div className="hshow-head hshow-wrap">
          <p className="eyebrow">{eyebrow}</p>

          <div className="hshow-headrow">
            <LensHeading text={heading} />
            <p className="hshow-count mono">
              <span ref={nowRef}>01</span>
              <span aria-hidden="true">/</span>
              <span>{pad2(items.length)}</span>
            </p>
          </div>

          <div className="hshow-bar" aria-hidden="true">
            <span ref={barRef} />
          </div>
        </div>

        <div className="hshow-viewport">
          <div className="hshow-rail" ref={railRef}>
            {items.map((project, i) => (
              <article
                className="hshow-slide"
                key={project.index}
                ref={(el) => {
                  slideRefs.current[i] = el;
                }}
              >
                {/* One panel holds both halves — the preview and the copy are
                    two columns of the same piece of glass, split by a rule,
                    not two cards with air between them. */}
                <div className="hshow-wrap hshow-panel">
                  <div
                    className="hshow-preview"
                    ref={(el) => {
                      previewRefs.current[i] = el;
                    }}
                  >
                    <div className="browser">
                      <div className="browser-bar" aria-hidden="true">
                        <span className="browser-dots">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="browser-url mono">
                          {hostOf(project.href)}
                        </span>
                      </div>
                      {/* The window is a crop of the capture; what it holds
                          back is what the hover pans down to. */}
                      <div className="browser-screen">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="browser-shot"
                          src={project.shot.src}
                          alt={project.shot.alt}
                          width={project.shot.width}
                          height={project.shot.height}
                          loading={i === 0 ? "eager" : "lazy"}
                          decoding="async"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hshow-copy">
                    {/* Sits under the copy and runs off the panel's corner,
                        where the panel's overflow cuts it. */}
                    <span className="hshow-ghost" aria-hidden="true">
                      {project.index}
                    </span>

                    <div className="hshow-copyhead">
                      <ProjectTitle
                        name={project.name}
                        href={project.href}
                        ref={(el) => {
                          titleRefs.current[i] = el;
                        }}
                      />
                      <p className="hshow-index mono">
                        <span>{project.index}</span>
                        <span aria-hidden="true">·</span>
                        <span>{project.year}</span>
                      </p>
                    </div>

                    <span className="hshow-rule" aria-hidden="true" />

                    <p className="hshow-tagline">{project.tagline}</p>

                    <p className="hshow-summary">{project.summary}</p>

                    <p className="pill pill-live mono">{project.status}</p>

                    <ul className="hshow-stack">
                      {project.stack.map((tool) => (
                        <li className="pill mono" key={tool}>
                          {tool}
                        </li>
                      ))}
                    </ul>

                    {/* The visible label rolls between two strings, so the
                        name the link is announced by comes from aria-label —
                        which never moves. */}
                    <a
                      className="hshow-cta mono"
                      href={project.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`Visit ${project.name}`}
                    >
                      <span className="hshow-roll" aria-hidden="true">
                        <span className="hshow-roll-track">
                          <span className="hshow-roll-item">Visit site</span>
                          <span className="hshow-roll-item">
                            {hostOf(project.href)}
                          </span>
                        </span>
                      </span>
                      <span className="hshow-cta-arrow" aria-hidden="true">
                        →
                      </span>
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}