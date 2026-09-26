"use client";

import { forwardRef, useLayoutEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Vector3,
  type MeshBasicMaterial,
} from "three";
import { palette } from "@/lib/palette";
import { ROAD_HALF_WIDTH, ROAD_LENGTH, roadCurve } from "@/lib/road";

/*
 * Wet road: the rain leaves the asphalt faintly reflective. Two pieces:
 *  - RoadSheen: a soft green glow strip on the road along each green edge line.
 *  - WetReflection: a mirrored, stretched, fading copy of a light source
 *    (neon sign, gantry) on the road below it.
 * Both are additive and very low opacity, so they read as a sheen, not as
 * extra neon (70/20/10 stays intact).
 */

/** Vertical gradient: bright at the top edge (the road surface), fading down. */
function useStreakTexture() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 128;
    const g = c.getContext("2d")!;
    const v = g.createLinearGradient(0, 0, 0, 128);
    v.addColorStop(0, "rgba(255,255,255,1)");
    v.addColorStop(0.35, "rgba(255,255,255,0.35)");
    v.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = v;
    g.fillRect(0, 0, 32, 128);
    // Soft sides, so the streak has no hard vertical edges.
    const h = g.createLinearGradient(0, 0, 32, 0);
    h.addColorStop(0, "rgba(0,0,0,1)");
    h.addColorStop(0.25, "rgba(0,0,0,0)");
    h.addColorStop(0.75, "rgba(0,0,0,0)");
    h.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = h;
    g.fillRect(0, 0, 32, 128);
    return new CanvasTexture(c);
  }, []);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

type ReflectionProps = {
  /** World center of the light source (its reflection sits at -y). */
  position: Vector3;
  yaw: number;
  width: number;
  height: number;
  color?: string;
  opacity?: number;
};

/** Mirror image of a light source on the wet road, stretched and fading down. */
export const WetReflection = forwardRef<MeshBasicMaterial, ReflectionProps>(function WetReflection(
  { position, yaw, width, height, color = palette.green, opacity = 0 },
  ref
) {
  const tex = useStreakTexture();
  // Top of the reflection meets the road under the source's bottom edge.
  const top = -(position.y - height / 2);
  const len = height * 1.7;
  return (
    <mesh position={[position.x, top - len / 2, position.z]} rotation-y={yaw}>
      <planeGeometry args={[width * 0.4, len]} />
      <meshBasicMaterial
        ref={ref}
        map={tex}
        color={color}
        transparent
        opacity={opacity}
        blending={AdditiveBlending}
        depthWrite={false}
        fog
      />
    </mesh>
  );
});

/** Soft green glow on the wet road along both green edge lines. */
export function RoadSheen({ from = 0, to = 1 }: { from?: number; to?: number }) {
  const geo = useMemo(() => {
    const n = Math.ceil(((to - from) * ROAD_LENGTH) / 2);
    const width = 1.4;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const green = new Color(palette.green);
    let base = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i <= n; i++) {
        const a = from + ((to - from) * i) / n;
        const p = roadCurve.getPointAt(a);
        const t = roadCurve.getTangentAt(a);
        const rx = -t.z;
        const rz = t.x;
        for (const [off, k] of [
          [-width, 0],
          [0, 1],
          [width, 0],
        ] as const) {
          const lat = side * (ROAD_HALF_WIDTH - 0.2) + off;
          pos.push(p.x + rx * lat, 0.004, p.z + rz * lat);
          col.push(green.r * k, green.g * k, green.b * k);
        }
        if (i < n) {
          const r0 = base + i * 3;
          const r1 = r0 + 3;
          for (let c = 0; c < 2; c++) idx.push(r0 + c, r1 + c, r0 + c + 1, r0 + c + 1, r1 + c, r1 + c + 1);
        }
      }
      base += (n + 1) * 3;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
    g.setIndex(idx);
    return g;
  }, [from, to]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial vertexColors transparent opacity={0.1} blending={AdditiveBlending} depthWrite={false} fog />
    </mesh>
  );
}
