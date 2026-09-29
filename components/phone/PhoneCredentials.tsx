"use client";

import { useEffect, useRef, useState } from "react";
import { CREDENTIALS, PERSON } from "@/lib/content";
import { useReducedMotion } from "@/lib/media";

/*
 * Phone Credentials: a small wireframe building that draws itself floor by
 * floor as the section scrolls in (one floor per credential, bottom first),
 * each floor lighting up with its label beside it; then the construction
 * signboard on two short legs, whose STATUS follows the build. Driven only by
 * scroll position, so it reverses on the way back up. Reduced motion shows the
 * finished building, still.
 */

const FLOORS = CREDENTIALS.length;
// Building drawing (viewBox units): front face, a shallow side face for depth.
const VB = { w: 150, h: 232 };
const X0 = 18;
const X1 = 98;
const DX = 26;
const DY = -13;
const GROUND = 224;
/** Tall enough for each floor's label (up to three lines) beside it. */
const FH = 62;
const floorBase = (k: number) => GROUND - 8 - FH * k;
const ROOF = floorBase(FLOORS);

/** 0..1 draw amount of floor k at build progress p (0..1). */
const floorDraw = (p: number, k: number) => Math.min(1, Math.max(0, p * (FLOORS + 0.4) - k));

function useBuildProgress(ref: React.RefObject<HTMLElement | null>, reduced: boolean) {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      // Starts as the building comes up from the bottom, done near the top.
      const v = (vh * 0.95 - top) / (vh * 0.8);
      setP(Math.round(Math.min(1, Math.max(0, v)) * 200) / 200);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref, reduced]);
  return reduced ? 1 : p;
}

/** One floor's lines as a single path (front box, side face, two windows). */
function floorPath(k: number) {
  const b = floorBase(k);
  const t = b - FH;
  const w1 = X0 + 12;
  const w2 = X0 + 46;
  const ww = 22;
  const wy = t + 18;
  const wh = 24;
  return [
    // Front face, drawn up from the ground line like a wall going up.
    `M${X0} ${b} V${t} H${X1} V${b}`,
    // Side face
    `M${X1} ${t} L${X1 + DX} ${t + DY} V${b + DY} L${X1} ${b}`,
    // Floor slab edge
    `M${X0} ${b} H${X1}`,
    // Windows
    `M${w1} ${wy} h${ww} v${wh} h${-ww} Z`,
    `M${w2} ${wy} h${ww} v${wh} h${-ww} Z`,
  ].join(" ");
}

export function PhoneCredentials() {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const p = useBuildProgress(box, reduced);
  const built = Array.from({ length: FLOORS }, (_, k) => floorDraw(p, k));
  const done = built.filter((f) => f >= 1).length;
  const finished = done === FLOORS;
  const building = Math.min(FLOORS, built.findIndex((f) => f < 1) + 1 || FLOORS);

  return (
    <div>
      <h2 className="sr-only">Credentials: what I studied</h2>
      <div ref={box} className="grid grid-cols-[150px_1fr] items-stretch gap-3">
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} width={VB.w} height={VB.h} aria-hidden className="block overflow-visible">
          {/* Plot and foundation */}
          <path
            d={`M4 ${GROUND} H${VB.w - 4} M${X0 - 4} ${GROUND - 8} H${X1 + 4} L${X1 + DX + 4} ${GROUND - 8 + DY} M${X0 - 4} ${GROUND - 8} V${GROUND} M${X1 + 4} ${GROUND - 8} V${GROUND}`}
            fill="none"
            stroke="#22c55e"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          {built.map((f, k) => {
            const lit = f >= 1;
            const b = floorBase(k);
            return (
              <g key={k}>
                {/* Lit floor: faint green on the front face, warm windows. */}
                <rect
                  x={X0}
                  y={b - FH}
                  width={X1 - X0}
                  height={FH}
                  fill="#22c55e"
                  opacity={lit ? 0.1 : 0}
                  className="transition-opacity duration-300"
                />
                {[X0 + 12, X0 + 46].map((x) => (
                  <rect
                    key={x}
                    x={x}
                    y={b - FH + 18}
                    width="22"
                    height="24"
                    fill="#f5e6c8"
                    opacity={lit ? 0.75 : 0}
                    className="transition-opacity duration-300"
                  />
                ))}
                <path
                  d={floorPath(k)}
                  pathLength={1}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - f}
                  strokeOpacity={lit ? 1 : 0.7}
                />
              </g>
            );
          })}
          {/* Roof: parapet and the blinking red light, once the top floor is up. */}
          <g opacity={finished ? 1 : 0} className="transition-opacity duration-300">
            <path
              d={`M${X0 - 3} ${ROOF} H${X1 + 3} L${X1 + DX + 3} ${ROOF + DY} H${X0 + DX - 3} Z`}
              fill="none"
              stroke="#22c55e"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <circle cx={X1 + DX + 3} cy={ROOF + DY - 3} r="2.4" fill="#f43f5e" className="roof-blink" />
          </g>
        </svg>

        {/* Labels beside each floor, top floor first in reading order. */}
        <ol className="relative" aria-label="Floors">
          {CREDENTIALS.map((c, k) => {
            const lit = built[k] >= 1;
            const mid = floorBase(k) - FH / 2;
            return (
              <li
                key={c.title}
                className="absolute inset-x-0 -translate-y-1/2 transition-opacity duration-300"
                style={{ top: `${(mid / VB.h) * 100}%`, opacity: lit ? 1 : 0.14 }}
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-green">Floor {k + 1}</p>
                <p className="text-[13px] leading-snug text-text">
                  {c.title}
                  {c.issuer ? `, ${c.issuer}` : ""} <span className="text-text-2">· {c.year}</span>
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Dhaka-style construction signboard on two short legs. */}
      <div className="relative mx-auto mt-8 max-w-sm pb-7">
        <div className="relative z-10 border border-green/60 bg-bg-night px-4 py-3.5">
          <dl className="grid grid-cols-[6.2rem_1fr] items-baseline gap-x-3 gap-y-2 text-sm">
            <dt className="font-mono text-[10px] uppercase tracking-widest text-text-2">Project</dt>
            <dd className="font-semibold text-text">What I studied</dd>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-text-2">Developer</dt>
            <dd className="text-text">{PERSON.shortName}</dd>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-text-2">Started</dt>
            <dd className="text-text">{CREDENTIALS[0].year}</dd>
            <dt className="font-mono text-[10px] uppercase tracking-widest text-text-2">Status</dt>
            <dd aria-live="off">
              {finished ? (
                <span className="status-blink font-mono font-semibold text-green">Still building</span>
              ) : (
                <span className="font-mono text-window">
                  {done === 0 && p === 0 ? "Breaking ground" : `Building floor ${building} of ${FLOORS}`}
                </span>
              )}
            </dd>
          </dl>
        </div>
        <span aria-hidden className="absolute bottom-0 left-[20%] top-4 w-px bg-green/40" />
        <span aria-hidden className="absolute bottom-0 right-[20%] top-4 w-px bg-green/40" />
      </div>
    </div>
  );
}
