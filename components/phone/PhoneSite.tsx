"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { ABOUT, PERSON } from "@/lib/content";
import { FEATURED } from "@/lib/bridge";
import { SECTIONS, sectionIndex } from "@/lib/sections";
import { tools } from "@/data/tools";
import { useReducedMotion } from "@/lib/media";
import { ContactPanel } from "../ContactPanel";
import { SoundToggle } from "../SoundToggle";
import { AboutHouse } from "./AboutHouse";
import { PhoneCredentials } from "./PhoneCredentials";
import { NeonSign } from "./NeonSign";

/*
 * Phone version (docs/SPEC.md section 8): no fly-through. One fixed, dim wireframe
 * skyline behind everything, and the sections scroll normally on top. The
 * canvases load after the text.
 */
const PhoneBackground = dynamic(() => import("./PhoneBackground"), { ssr: false });
const PhoneSangsad = dynamic(() => import("./PhoneSangsad"), { ssr: false });

const NAV = [
  { label: "About", href: "#about" },
  { label: "Work", href: "#projects" },
  { label: "Contact", href: "#contact" },
];

function Eyebrow({ id, label }: { id: string; label: string }) {
  return (
    <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-green">
      {String(SECTIONS[sectionIndex(id)].num).padStart(2, "0")} / {label}
    </p>
  );
}

function Section({ id, label, children, className = "" }: { id: string; label: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-label={label} className={`relative scroll-mt-16 px-6 py-20 ${className}`}>
      <div className="mx-auto max-w-xl">{children}</div>
    </section>
  );
}

export default function PhoneSite() {
  const reduced = useReducedMotion();

  return (
    <>
      <PhoneBackground reduced={reduced} />
      <PhoneNav reduced={reduced} />
      <main className="relative z-10">
        <Hero />
        <About />
        <Credentials />
        <TechStack />
        <Projects />
        <Contact reduced={reduced} />
      </main>
    </>
  );
}

/* ---------------- Nav ---------------- */

function PhoneNav({ reduced }: { reduced: boolean }) {
  const links = useRef<(HTMLAnchorElement | null)[]>([]);

  // Mark the link whose section fills the middle of the screen.
  useEffect(() => {
    const targets = NAV.map((n) => document.querySelector(n.href)).filter(Boolean) as Element[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = NAV.findIndex((n) => n.href === `#${e.target.id}`);
          const el = links.current[i];
          if (!el) continue;
          if (e.isIntersecting) el.setAttribute("aria-current", "location");
          else el.removeAttribute("aria-current");
        }
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  const go = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    const el = document.querySelector(href);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 bg-gradient-to-b from-bg-night via-bg-night/85 to-transparent">
      <nav aria-label="Main" className="mx-auto flex max-w-xl items-center justify-between px-6 py-4">
        <a
          href="#top"
          onClick={(e) => go(e, "#top")}
          className="font-mono text-xs uppercase tracking-[0.3em] text-text"
        >
          {PERSON.shortName}
        </a>
        <ul className="flex items-center gap-5">
          {NAV.map((item, i) => (
            <li key={item.label}>
              <a
                ref={(el) => {
                  links.current[i] = el;
                }}
                href={item.href}
                onClick={(e) => go(e, item.href)}
                className="py-2 text-sm text-text-2 aria-[current=location]:text-green"
              >
                {item.label}
              </a>
            </li>
          ))}
          <li>
            <SoundToggle compact />
          </li>
        </ul>
      </nav>
    </header>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  return (
    <section
      id="top"
      aria-label="Hero"
      className="flex min-h-[100svh] flex-col items-center justify-center px-6 pb-[18svh] pt-24 text-center"
    >
      {PERSON.available && (
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-green/40 bg-green/10 px-3 py-1 text-xs font-medium text-green">
          <span className="h-1.5 w-1.5 rounded-full bg-green motion-safe:animate-pulse" aria-hidden />
          Available for work
        </p>
      )}
      <h1 className="text-5xl font-semibold tracking-tight text-text">Hi. I&apos;m {PERSON.shortName}.</h1>
      <p className="mt-5 text-lg text-text-2">
        {PERSON.role}, {PERSON.location}
      </p>
    </section>
  );
}

/* ---------------- About ---------------- */

function About() {
  return (
    <Section id="about" label="About">
      <Eyebrow id="about" label="About" />
      <AboutHouse />
      {/* The same code card as on desktop, attached below the lit window. */}
      <div className="relative mx-auto -mt-2 w-full max-w-md overflow-hidden rounded-md border border-green/25 bg-bg-night">
        <h2 className="sr-only">About</h2>
        <div aria-hidden className="flex items-center gap-1.5 border-b border-green/15 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-text-2/30" />
          <span className="h-2 w-2 rounded-full bg-text-2/30" />
          <span className="h-2 w-2 rounded-full bg-text-2/30" />
          <span className="ml-3 font-mono text-[11px] tracking-wide text-text-2">index.html</span>
        </div>
        <div className="grid grid-cols-[1.25rem_1fr] gap-x-3 px-4 pb-5 pt-4">
          <Ln n={1} />
          <p aria-hidden className="font-mono text-base leading-[1.6] text-window">
            {"<h1>Hello</h1>"}
          </p>
          <Ln n={2} />
          <p className="mt-3 font-mono text-[11px] uppercase leading-[1.6] tracking-[0.25em] text-text-2">2020 · lockdown</p>
          <Ln n={3} />
          <p className="mt-1 text-lg leading-snug text-text">{ABOUT.lines[0]}</p>
          <Ln n={4} />
          <p className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-green">
            {ABOUT.lines[1]}
            <span
              aria-hidden
              className="about-cursor ml-1 inline-block h-[0.95em] w-[0.5em] translate-y-[0.12em] bg-red"
            />
          </p>
        </div>
      </div>
    </Section>
  );
}

function Ln({ n }: { n: number }) {
  return (
    <span aria-hidden className="select-none pt-[0.3em] text-right font-mono text-[11px] leading-[1.6] text-text-2/40">
      {n}
    </span>
  );
}

/* ---------------- Credentials ---------------- */

function Credentials() {
  return (
    <Section id="credentials" label="Credentials" className="!pt-2">
      <Eyebrow id="credentials" label="Credentials" />
      <PhoneCredentials />
    </Section>
  );
}

/* ---------------- Tech stack ---------------- */

const ZONES = [
  { zone: "frontend", title: "Frontend", note: "What users see" },
  { zone: "backend", title: "Backend & Data", note: "What runs behind it" },
  { zone: "server", title: "Deploy & DevOps", note: "Where it goes live" },
] as const;

function TechStack() {
  return (
    <Section id="toolset" label="Tech stack">
      <Eyebrow id="toolset" label="Tech stack" />
      <TechGate />
      <p className="mx-auto mt-3 max-w-sm rounded-sm border border-green/60 bg-bg-night px-4 py-2 text-center text-sm text-text">
        Tools I use to design, build and ship websites.
      </p>
      <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-widest text-text-2">Tap a sign to flicker it</p>
      {ZONES.map((z) => (
        <div key={z.zone} className="mt-10">
          {/* Street name plate for the zone. */}
          <div className="mb-4 inline-block rounded-sm border-2 border-green bg-bg-night px-4 py-2">
            <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-green">{z.title}</h3>
            <p className="font-mono text-xs text-text">{z.note}</p>
          </div>
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {tools
              .filter((t) => t.zone === z.zone)
              .map((t, i) => (
                <li key={t.name}>
                  <NeonSign name={t.name} logo={t.logo} level={t.level} index={i} />
                </li>
              ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}

/** The MY TECH STACK gate as the heading: two posts, an arch and the neon beam. */
function TechGate() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <h2 className="sr-only">My tech stack</h2>
      <svg aria-hidden viewBox="0 0 360 150" className="block w-full">
        <defs>
          <filter id="gate-glow" x="-10%" y="-40%" width="120%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Posts and cross bars */}
        {[14, 346].map((x) => (
          <g key={x} stroke="#1e2a24" strokeWidth="1.5">
            <line x1={x - 5} y1="58" x2={x - 5} y2="150" />
            <line x1={x + 5} y1="58" x2={x + 5} y2="150" />
            {[80, 100, 120, 140].map((y) => (
              <line key={y} x1={x - 5} y1={y} x2={x + 5} y2={y} />
            ))}
          </g>
        ))}
        {/* Arch */}
        <path d="M14 58 Q180 -14 346 58" fill="none" stroke="#22c55e" strokeWidth="2" filter="url(#gate-glow)" />
        {/* Beam */}
        <rect x="24" y="58" width="312" height="52" fill="#0a0f0c" stroke="#22c55e" strokeWidth="1.6" />
        <text
          x="180"
          y="92"
          textAnchor="middle"
          fontFamily="var(--font-geist-mono), monospace"
          fontWeight="600"
          fontSize="27"
          letterSpacing="2"
          fill="#d6f7e1"
          stroke="#22c55e"
          strokeWidth="0.6"
          filter="url(#gate-glow)"
        >
          MY TECH STACK
        </text>
      </svg>
    </div>
  );
}

/* ---------------- Projects ---------------- */

function Projects() {
  return (
    <Section id="projects" label="Projects">
      <Eyebrow id="projects" label="Projects" />
      {/* The green highway sign as the heading. */}
      <div className="relative mx-auto mt-6 max-w-md">
        <span className="absolute -top-5 right-4 rounded-t-sm border-2 border-b-0 border-[#d6f7e1] bg-[#114625] px-2 py-0.5 font-mono text-[11px] font-semibold tracking-widest text-[#d6f7e1]">
          EXIT 05
        </span>
        <div className="rounded-sm border-2 border-[#d6f7e1] bg-[#114625] px-5 py-4 shadow-[0_0_30px_rgb(34_197_94/0.18)]">
          <h2 className="flex items-center gap-2.5 whitespace-nowrap font-mono text-xl font-semibold tracking-wide text-[#f2fff6]">
            PROJECTS <span aria-hidden>↑</span>
            <span className="text-[13px] font-medium text-[#d6f7e1]">Things I shipped</span>
          </h2>
        </div>
      </div>

      <ul className="mt-10 space-y-8">
        {FEATURED.map((p) => (
          <li key={p.slug} className="overflow-hidden rounded-md border border-green/40 bg-bg-night">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image}
              alt={`${p.name} website`}
              loading="lazy"
              decoding="async"
              width={1280}
              height={800}
              className="aspect-[16/10] w-full object-cover object-top"
            />
            <div className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-mono text-lg font-semibold text-text">{p.name}</h3>
                <p className="font-mono text-xs text-text-2">
                  {p.year} · {p.status}
                </p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-2">{p.what}</p>
              <ul aria-label="Stack" className="mt-3 flex flex-wrap gap-1.5">
                {p.stack.map((s) => (
                  <li key={s} className="rounded-sm border border-green/30 px-2 py-0.5 font-mono text-[11px] text-text">
                    {s}
                  </li>
                ))}
              </ul>
              <a
                href={p.url}
                target="_blank"
                rel="noopener"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-green px-4 py-2 text-sm font-semibold text-green"
              >
                Visit <span aria-hidden>↗</span>
                <span className="sr-only">{p.name}</span>
              </a>
            </div>
          </li>
        ))}
      </ul>

      <a
        href="/projects"
        className="mt-8 flex items-center justify-center gap-2 rounded-sm border-2 border-green px-4 py-3 font-mono text-sm font-semibold text-green"
      >
        All projects <span aria-hidden>→</span>
      </a>
    </Section>
  );
}

/* ---------------- Contact ---------------- */

function Contact({ reduced }: { reduced: boolean }) {
  return (
    <section id="contact" aria-label="Contact" className="relative scroll-mt-16 pb-16 pt-12">
      {/* Sangsad Bhaban across the lake, the red sun rising behind it. */}
      <PhoneSangsad reduced={reduced} />
      <div className="relative mx-auto mt-3 max-w-xl px-4">
        <ContactPanel eyebrow={<Eyebrow id="contact" label="Contact" />} />
      </div>
    </section>
  );
}
