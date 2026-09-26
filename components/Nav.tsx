"use client";

import { useEffect, useRef } from "react";
import { PERSON } from "@/lib/content";
import { scrollNav } from "@/lib/navItems";
import { scrollToSection } from "@/lib/scrollNav";
import { scrollStore } from "@/lib/scrollStore";

/** Minimal top nav. Each link scrolls (via Lenis) to that section's camera stop. */
export function Nav() {
  const links = useRef<(HTMLAnchorElement | null)[]>([]);

  // Mark the link for the section the camera is at.
  useEffect(() => {
    let id = 0;
    let last = -1;
    const loop = () => {
      const s = scrollStore.section;
      if (s !== last) {
        last = s;
        scrollNav.forEach((item, i) => {
          const el = links.current[i];
          if (!el) return;
          if (item.sections.includes(s)) el.setAttribute("aria-current", "location");
          else el.removeAttribute("aria-current");
        });
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  const go = (e: React.MouseEvent, index: number, phase?: number) => {
    e.preventDefault();
    scrollToSection(index, phase);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10"
      >
        <a
          href="#top"
          onClick={(e) => go(e, 0)}
          className="font-mono text-xs uppercase tracking-[0.3em] text-text transition-colors hover:text-green"
        >
          {PERSON.shortName}
        </a>
        <ul className="flex items-center gap-6 sm:gap-8">
          {scrollNav.map((item, i) => (
            <li key={item.label}>
              <a
                ref={(el) => {
                  links.current[i] = el;
                }}
                href={`#${item.label.toLowerCase()}`}
                onClick={(e) => go(e, item.target, item.phase)}
                className="text-sm text-text-2 transition-colors hover:text-text aria-[current=location]:text-green"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
