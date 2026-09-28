"use client";

import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { scrollStore } from "@/lib/scrollStore";

/**
 * Fades a whole group in and out from scroll (stop space), so a sign never
 * pops in or shows half-cut at the screen edge before its moment. Children
 * may animate their own opacity every frame: a change since our last write
 * is taken as the new base, then scaled by the fade.
 */
export function ScrollFade({ show, children }: { show: (stop: number) => number; children: ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const k = show(scrollStore.stop);
    g.visible = k > 0.002;
    if (!g.visible) return;
    g.traverse((o) => {
      const mats = (o as Mesh).material;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) {
        const u = m.userData as { fadeBase?: number; fadeWrote?: number };
        if (u.fadeBase === undefined || m.opacity !== u.fadeWrote) u.fadeBase = m.opacity;
        m.transparent = true;
        m.opacity = u.fadeBase * k;
        u.fadeWrote = m.opacity;
      }
    });
  });
  return <group ref={group}>{children}</group>;
}

