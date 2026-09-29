"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { cursorStore } from "@/lib/cursorStore";

/*
 * Custom desktop cursor: a small green dot on the pointer, and four thin
 * corner brackets that glide after it (frame-rate independent damping). Over
 * something clickable the brackets snap around it with a little padding and a
 * small label: 3D targets come from cursorStore (projected every frame by
 * CursorProbe), nav links and buttons from the DOM. A click squeezes them in.
 * Over text fields the normal text cursor shows instead. Transforms only, one
 * requestAnimationFrame loop that sleeps once everything has settled.
 *
 * Only with a fine pointer that can hover and without reduced motion; touch
 * devices and reduced motion keep the normal cursor.
 */

const QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
const IDLE = 26; // bracket box around the bare pointer (px)
const CORNER = 8;
const PAD_3D = 8;
const PAD_DOM = 6;
const FOLLOW = 16; // damping rate (1/s) while gliding after the pointer
const SNAP = 22; // damping rate when snapping onto a target
const SQUEEZE_DECAY = 9;

const CLICKABLE = "a, button, [role='button'], summary";
const TEXT_FIELD = "input:not([type='button']):not([type='submit']):not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true']";

function useCursorEnabled() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}

export function Cursor() {
  const enabled = useCursorEnabled();
  return enabled ? <CursorLayer /> : null;
}

function CursorLayer() {
  const root = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const corners = useRef<(HTMLDivElement | null)[]>([]);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("custom-cursor");

    const mouse = { x: -100, y: -100, inside: false };
    const box = { x0: -100, y0: -100, x1: -100, y1: -100 };
    let squeeze = 0;
    let domTarget: Element | null = null;
    let overText = false;
    let shownLabel = "";
    let visible = false;
    let raf = 0;
    let last = 0;

    const setVisible = (v: boolean) => {
      if (v === visible || !root.current) return;
      visible = v;
      root.current.style.opacity = v ? "1" : "0";
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;

      // Where the brackets want to be.
      let tx0: number;
      let ty0: number;
      let tx1: number;
      let ty1: number;
      let text = "";
      let locked = true;
      const r3 = cursorStore.target ? cursorStore.rect : null;
      if (domTarget) {
        const r = domTarget.getBoundingClientRect();
        tx0 = r.left - PAD_DOM;
        ty0 = r.top - PAD_DOM;
        tx1 = r.right + PAD_DOM;
        ty1 = r.bottom + PAD_DOM;
      } else if (r3) {
        tx0 = r3.x0 - PAD_3D;
        ty0 = r3.y0 - PAD_3D;
        tx1 = r3.x1 + PAD_3D;
        ty1 = r3.y1 + PAD_3D;
        text = cursorStore.target?.label ?? "";
      } else {
        locked = false;
        tx0 = mouse.x - IDLE / 2;
        ty0 = mouse.y - IDLE / 2;
        tx1 = mouse.x + IDLE / 2;
        ty1 = mouse.y + IDLE / 2;
      }

      const k = 1 - Math.exp(-dt * (locked ? SNAP : FOLLOW));
      box.x0 += (tx0 - box.x0) * k;
      box.y0 += (ty0 - box.y0) * k;
      box.x1 += (tx1 - box.x1) * k;
      box.y1 += (ty1 - box.y1) * k;
      squeeze *= Math.exp(-dt * SQUEEZE_DECAY);

      // Squeeze toward the centre on click.
      const cx = (box.x0 + box.x1) / 2;
      const cy = (box.y0 + box.y1) / 2;
      const s = 1 - 0.28 * squeeze;
      const x0 = cx + (box.x0 - cx) * s;
      const x1 = cx + (box.x1 - cx) * s;
      const y0 = cy + (box.y0 - cy) * s;
      const y1 = cy + (box.y1 - cy) * s;

      const c = corners.current;
      const place = (el: HTMLDivElement | null, x: number, y: number) => {
        if (el) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      };
      place(c[0], x0, y0);
      place(c[1], x1 - CORNER, y0);
      place(c[2], x0, y1 - CORNER);
      place(c[3], x1 - CORNER, y1 - CORNER);
      place(dot.current, mouse.x - 3, mouse.y - 3);

      if (label.current) {
        if (text !== shownLabel) {
          shownLabel = text;
          label.current.textContent = text;
          label.current.style.opacity = text ? "1" : "0";
        }
        if (text) place(label.current, x0, y1 + 6);
      }

      // Keep running while locked (the target moves with the camera) or
      // until the brackets have settled; otherwise sleep until the next event.
      const moving =
        Math.abs(tx0 - box.x0) + Math.abs(ty0 - box.y0) + Math.abs(tx1 - box.x1) + Math.abs(ty1 - box.y1) > 0.3 ||
        squeeze > 0.01;
      if (locked || moving) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (!mouse.inside) {
        // First move: start the brackets on the pointer, no glide in from a corner.
        box.x0 = e.clientX - IDLE / 2;
        box.y0 = e.clientY - IDLE / 2;
        box.x1 = e.clientX + IDLE / 2;
        box.y1 = e.clientY + IDLE / 2;
      }
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.inside = true;
      setVisible(!overText);
      wake();
    };
    const onOver = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      overText = !!el?.closest(TEXT_FIELD);
      domTarget = overText ? null : (el?.closest(CLICKABLE) ?? null);
      setVisible(mouse.inside && !overText);
      wake();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      mouse.inside = false;
      setVisible(false);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      squeeze = 1;
      wake();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onLeave, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("scroll", wake, { passive: true });
    return () => {
      html.classList.remove("custom-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", wake);
      cancelAnimationFrame(raf);
    };
  }, []);

  const corner = "absolute left-0 top-0 h-2 w-2 border-green will-change-transform";
  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed inset-0 z-[60] opacity-0 transition-opacity duration-150">
      <div ref={dot} className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-green will-change-transform" />
      {[
        "border-l-[1.5px] border-t-[1.5px]",
        "border-r-[1.5px] border-t-[1.5px]",
        "border-b-[1.5px] border-l-[1.5px]",
        "border-b-[1.5px] border-r-[1.5px]",
      ].map((sides, i) => (
        <div
          key={i}
          ref={(el) => {
            corners.current[i] = el;
          }}
          className={`${corner} ${sides}`}
        />
      ))}
      <div
        ref={label}
        className="absolute left-0 top-0 font-mono text-[10px] uppercase tracking-[0.2em] text-green opacity-0 transition-opacity duration-150 will-change-transform"
      />
    </div>
  );
}
