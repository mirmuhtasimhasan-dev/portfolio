"use client";

import { useSyncExternalStore } from "react";

/*
 * Media-query hooks. The server (and the hydration pass) always sees the
 * desktop, full-motion answer; the client switches right after hydration and
 * follows changes (rotation, resize, a system setting toggled).
 */

/** Phone mode (docs/SPEC.md section 8): a touch device, or narrower than 900 px. */
export const PHONE_QUERY = "(hover: none) and (pointer: coarse), (max-width: 899px)";
export const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

export const usePhoneMode = () => useMedia(PHONE_QUERY);
export const useReducedMotion = () => useMedia(REDUCED_QUERY);
