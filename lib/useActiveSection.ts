"use client";

import { useSyncExternalStore } from "react";
import { content } from "./content";

/* ------------------------------------------------------------------
   One IntersectionObserver for the whole page, shared by every navbar.
   A section is "active" while it crosses the band around 45% down the
   viewport — which behaves the same for a 100svh hero and a 240vh
   showcase, where largest-intersection-ratio does not.
   ------------------------------------------------------------------ */

const FIRST = content.nav[0].id;

let active = FIRST;
const subs = new Set<() => void>();
let observer: IntersectionObserver | null = null;

function set(next: string) {
  if (next === active) return;
  active = next;
  subs.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subs.add(fn);

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) set(entry.target.id);
        }
      },
      { rootMargin: "-42% 0px -53% 0px", threshold: 0 },
    );
    for (const link of content.nav) {
      const el = document.getElementById(link.id);
      if (el) observer.observe(el);
    }
  }

  return () => {
    subs.delete(fn);
    if (subs.size === 0) {
      observer?.disconnect();
      observer = null;
    }
  };
}

const snapshot = () => active;
const serverSnapshot = () => FIRST;

export function useActiveSection(): string {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}