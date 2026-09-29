"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Box3, Vector3 } from "three";
import { cursorStore } from "@/lib/cursorStore";

/**
 * Projects the object the custom cursor is locked on (a sign, billboard,
 * gantry row or Sangsad Bhaban) to a screen rectangle every frame, so the
 * brackets follow it while the camera moves.
 */
export function CursorProbe() {
  const box = useMemo(() => new Box3(), []);
  const v = useMemo(() => new Vector3(), []);

  useFrame(({ camera, size }) => {
    const t = cursorStore.target;
    if (!t) return;
    box.setFromObject(t.object);
    if (box.isEmpty()) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    if (!Number.isFinite(x0)) return;
    // Clamp to the screen (the Sangsad model is wider than the frame).
    cursorStore.rect = {
      x0: Math.max(4, x0),
      y0: Math.max(4, y0),
      x1: Math.min(size.width - 4, x1),
      y1: Math.min(size.height - 4, y1),
    };
  });

  return null;
}
