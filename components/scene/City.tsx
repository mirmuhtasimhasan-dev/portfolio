"use client";

import { useLayoutEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color } from "three";
import { generateCity } from "@/lib/city";
import { palette } from "@/lib/palette";

export function City() {
  const geometry = useMemo(() => {
    const { positions, emphasis } = generateCity();
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));

    const base = new Color(palette.lineBase);
    const front = base.clone().lerp(new Color(palette.green), 0.12);
    const colors = new Float32Array(emphasis.length * 3);
    for (let i = 0; i < emphasis.length; i++) {
      const c = emphasis[i] > 0.5 ? front : base;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new BufferAttribute(colors, 3));
    g.computeBoundingSphere();
    return g;
  }, []);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors fog />
    </lineSegments>
  );
}
