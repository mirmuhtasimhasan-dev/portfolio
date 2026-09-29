"use client";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { scrollStore } from "@/lib/scrollStore";
import { sectionOpacity } from "@/lib/stopMap";
import { contactPhase, contactText } from "@/lib/timeline";
import { CREDENTIALS, PERSON } from "@/lib/content";
import { FEATURED } from "@/lib/bridge";
import { ContactPanel } from "./ContactPanel";

export type OverlaysHandle = { update: () => void };

// Dark scrim behind each text block so no city lines cross the text.
const SCRIM =
  "radial-gradient(closest-side, rgb(10 15 12 / 0.97) 0%, rgb(10 15 12 / 0.95) 68%, rgb(10 15 12 / 0) 100%)";

function Eyebrow({ index, label }: { index: number; label: string }) {
  return (
    <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-green">
      {String(SECTIONS[index].num).padStart(2, "0")} / {label}
    </p>
  );
}

const ZONES_TEXT: Record<string, { title: string; note: string }> = {
  toolset: { title: "Frontend", note: "What users see" },
  gali: { title: "Backend & Data", note: "What runs behind it" },
  roof: { title: "Deploy & DevOps", note: "Where it goes live" },
};

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
  gali: "items-start justify-center text-center pt-[12vh]",
  roof: "items-end justify-center text-center pb-[10vh]",
  contact: "items-end justify-center pb-[3vh]",
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
        </Scrimmed>
      );
    case "about":
      // The About text lives in the card attached to the lit window (AboutCard).
      return null;
    case "credentials":
      // Shown on the construction signboard and the floor banners (3D);
      // this copy is for screen readers.
      return (
        <div className="sr-only">
          <h2>Credentials: what I studied</h2>
          <ul>
            {CREDENTIALS.map((c) => (
              <li key={c.title}>
                {c.title}
                {c.issuer ? `, ${c.issuer}` : ""} ({c.year})
              </li>
            ))}
          </ul>
        </div>
      );
    case "toolset":
    case "gali":
    case "roof": {
      // The street plates are in the scene; this copy is for screen readers.
      const zone = ZONES_TEXT[id];
      return (
        <div className="sr-only">
          <h2>
            {id === "toolset" ? "My tech stack. " : ""}
            {zone.title}: {zone.note}
          </h2>
        </div>
      );
    }
    case "projects":
      // The gantry sign over the road is the heading; this is for screen readers.
      return (
        <div className="sr-only">
          <h2>Projects</h2>
          <ul>
            {FEATURED.map((p) => (
              <li key={p.slug}>
                {p.name} ({p.year}, {p.status}): {p.what}
              </li>
            ))}
          </ul>
          <a href="/projects">All projects</a>
        </div>
      );
    case "contact":
      return (
        // One clean card, no blurred backing.
        <div className="w-full max-w-4xl">
          <ContactPanel eyebrow={<Eyebrow index={index} label="Contact" />} />
        </div>
      );
    default:
      return null;
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
      const contactReveal = contactText(contactPhase(scrollStore.progress));
      panels.current.forEach((el, i) => {
        if (!el) return;
        // Contact: "Say hello" and the form wait for the sunrise.
        const o = sectionOpacity(s, i) * (SECTIONS[i].id === "contact" ? contactReveal : 1);
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
          className={`absolute inset-0 flex px-6 sm:px-16 ${LAYOUT[sec.id] ?? ""}`}
          style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? "visible" : "hidden" }}
        >
          <SectionBody id={sec.id} index={i} />
        </section>
      ))}
    </div>
  );
});
