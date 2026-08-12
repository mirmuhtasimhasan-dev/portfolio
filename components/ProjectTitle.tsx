"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { scrambleTo, type ScrambleHandle } from "@/lib/scramble";

/* ------------------------------------------------------------------
   §6b · The project title, as a link that announces itself.

   Hovered, the name scrambles into what clicking it will do. Left, it
   scrambles back. Arriving on its slide, it decodes once from noise.

   The accessible name never joins in: it is the project's name at
   every moment, on the anchor, while the glyphs churn inside an
   aria-hidden span. A screen reader is told what the link is, not
   what it is doing.

   Width is reserved by rendering both labels, stacked in one grid
   cell and hidden — the box is the wider of the two and the live text
   is absolutely positioned over it, so nothing it does can reflow the
   row it sits in.
   ------------------------------------------------------------------ */

const HOVER_LABEL = "View project →";

export type ProjectTitleHandle = { decode: () => void };

const ProjectTitle = forwardRef<
  ProjectTitleHandle,
  { name: string; href: string }
>(function ProjectTitle({ name, href }, ref) {
  const textRef = useRef<HTMLSpanElement>(null);
  const runRef = useRef<ScrambleHandle | null>(null);
  const reduced = useRef(false);
  const canHover = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    canHover.current = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    return () => runRef.current?.cancel();
  }, []);

  const run = useCallback((to: string) => {
    const el = textRef.current;
    if (!el) return;
    runRef.current?.cancel(); // never two loops on one node
    runRef.current = scrambleTo(el, to, { instant: reduced.current });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      decode() {
        run(name);
      },
    }),
    [run, name],
  );

  /* Bound unconditionally, gated at the edge: a tap fires pointerenter
     too, and on a device that cannot hover this is just a link. */
  const onEnter = useCallback(() => {
    if (canHover.current) run(HOVER_LABEL);
  }, [run]);

  const onLeave = useCallback(() => {
    if (canHover.current) run(name);
  }, [run, name]);

  return (
    <h3 className="hshow-name">
      <a
        className="hshow-namelink"
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={name}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        <span className="hshow-name-swap" aria-hidden="true">
          {/* both labels reserve the box; neither is ever seen */}
          <span className="hshow-name-res">{name}</span>
          <span className="hshow-name-res">{HOVER_LABEL}</span>
          <span className="hshow-name-text" ref={textRef}>
            {name}
          </span>
        </span>
      </a>
    </h3>
  );
});

export default ProjectTitle;