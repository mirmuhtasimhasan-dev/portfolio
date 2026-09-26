"use client";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { scrollStore } from "@/lib/scrollStore";
import { sectionOpacity } from "@/lib/stopMap";
import { aboutPhase, aboutText } from "@/lib/timeline";
import { ABOUT, CREDENTIALS, PERSON } from "@/lib/content";
import { ContactPanel } from "./ContactPanel";

export type OverlaysHandle = { update: () => void };

// Dark scrim behind each text block so no city lines cross the text.
const SCRIM =
  "radial-gradient(closest-side, rgb(10 15 12 / 0.97) 0%, rgb(10 15 12 / 0.95) 68%, rgb(10 15 12 / 0) 100%)";

function Eyebrow({ index, label }: { index: number; label: string }) {
  return (
    <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-green">
      {String(index + 1).padStart(2, "0")} / {label}
    </p>
  );
}

function Scrimmed({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative isolate ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-32 -inset-y-24 -z-10"
        style={{ background: SCRIM }}
      />
      {children}
    </div>
  );
}

// Where each panel sits: the emptiest part of that stop's frame.
const LAYOUT: Record<SectionId, string> = {
  hero: "items-start justify-center text-center pt-[15vh]",
  about: "items-center justify-start",
  credentials: "items-start justify-end text-right pt-[14vh]",
  toolset: "items-start justify-center text-center pt-[12vh]",
  projects: "items-start justify-start pt-[14vh]",
  contact: "items-center justify-center pt-12",
};

function SectionBody({ id, index }: { id: SectionId; index: number }) {
  switch (id) {
    case "hero":
      return (
        <Scrimmed className="max-w-2xl">
          {PERSON.available && (
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-green/40 bg-green/10 px-3 py-1 text-xs font-medium text-green">
              <span className="h-1.5 w-1.5 rounded-full bg-green motion-safe:animate-pulse" aria-hidden />
              Available for work
            </p>
          )}
          <h1 className="text-5xl font-semibold tracking-tight text-text sm:text-7xl">
            Hi. I&apos;m {PERSON.shortName}.
          </h1>
          <p className="mt-5 text-lg text-text-2 sm:text-xl">
            {PERSON.role}, {PERSON.location}
          </p>
          <a
            href={PERSON.resume}
            target="_blank"
            rel="noopener"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-green px-6 py-3 text-sm font-semibold text-bg-night transition-colors hover:bg-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green"
          >
            Resume
            <span aria-hidden>↓</span>
          </a>
        </Scrimmed>
      );
    case "about":
      return (
        <Scrimmed className="max-w-xl">
          <Eyebrow index={index} label="About" />
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-text sm:text-5xl">
            {ABOUT.lines[0]}
          </h2>
          <p className="mt-5 text-xl text-text-2 sm:text-2xl">{ABOUT.lines[1]}</p>
        </Scrimmed>
      );
    case "credentials":
      return (
        <Scrimmed className="max-w-sm">
          <Eyebrow index={index} label="Credentials" />
          <h2 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">What I studied</h2>
          {/* The visible labels are on the building's floors; this list is for screen readers. */}
          <ul className="sr-only">
            {CREDENTIALS.map((c) => (
              <li key={c.title}>
                {c.title}
                {c.issuer ? `, ${c.issuer}` : ""} ({c.year})
              </li>
            ))}
          </ul>
        </Scrimmed>
      );
    case "toolset":
      return (
        <Scrimmed className="max-w-xl">
          <Eyebrow index={index} label="Toolset" />
          <h2 className="text-3xl font-semibold tracking-tight text-text sm:text-5xl">The Neon Bazaar</h2>
          <p className="mt-4 text-base text-text-2">
            Hover a sign to see where I used it. Click it to send it down the cable.
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-text-2/80">
            Frontend street · Backend gali · Server roof
          </p>
        </Scrimmed>
      );
    case "projects":
      return (
        <Scrimmed className="max-w-xl">
          <Eyebrow index={index} label="Projects" />
          <h2 className="text-4xl font-semibold tracking-tight text-text sm:text-6xl">Projects</h2>
          <p className="mt-4 text-base text-text-2 sm:text-lg">Placeholder: Hatirjheel billboards.</p>
        </Scrimmed>
      );
    case "contact":
      return (
        <Scrimmed className="w-full max-w-4xl">
          <ContactPanel eyebrow={<Eyebrow index={index} label="Contact" />} />
        </Scrimmed>
      );
  }
}

/**
 * Fixed layer with one panel per section. Opacity and offset are written
 * straight to the DOM from master progress every tick (no React re-render).
 */
export const Overlays = forwardRef<OverlaysHandle>(function Overlays(_, ref) {
  const panels = useRef<(HTMLElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    update() {
      const s = scrollStore.stop;
      const aboutReveal = aboutText(aboutPhase(scrollStore.progress));
      panels.current.forEach((el, i) => {
        if (!el) return;
        // About text waits for the lockdown-night sequence to finish.
        const o = sectionOpacity(s, i) * (SECTIONS[i].id === "about" ? aboutReveal : 1);
        const y = Math.max(-1, Math.min(1, i - s)) * 40;
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        el.style.visibility = o < 0.002 ? "hidden" : "visible";
        el.style.pointerEvents = "none";
        const content = el.firstElementChild as HTMLElement | null;
        if (content) content.style.pointerEvents = o > 0.6 ? "auto" : "none";
      });
    },
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {SECTIONS.map((sec, i) => (
        <section
          key={sec.id}
          id={sec.id}
          ref={(el) => {
            panels.current[i] = el;
          }}
          aria-label={sec.label}
          className={`absolute inset-0 flex px-6 sm:px-16 ${LAYOUT[sec.id]}`}
          style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? "visible" : "hidden" }}
        >
          <SectionBody id={sec.id} index={i} />
        </section>
      ))}
    </div>
  );
});
