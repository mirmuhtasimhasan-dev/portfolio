"use client";

import { useLayoutEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import { ROAD_HALF_WIDTH, ROAD_LENGTH, roadCurve } from "@/lib/paths";
import { palette } from "@/lib/palette";
import { SIDEWALK } from "@/lib/contentBuildings";

const UP = new Vector3(0, 1, 0);

function offsetPolyline(lateral: number, steps: number, y = 0.02): number[] {
  const out: number[] = [];
  const right = new Vector3();
  let prev: Vector3 | null = null;
  for (let i = 0; i <= steps; i++) {
    const a = i / steps;
    const p = roadCurve.getPointAt(a);
    right.crossVectors(roadCurve.getTangentAt(a), UP).normalize();
    p.addScaledVector(right, lateral).setY(y);
    if (prev) out.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
    prev = p;
  }
  return out;
}

function dashes(length: number, gap: number, y = 0.02): number[] {
  const out: number[] = [];
  for (let d = 0; d + length < ROAD_LENGTH; d += length + gap) {
    const a = roadCurve.getPointAt(d / ROAD_LENGTH).setY(y);
    const b = roadCurve.getPointAt((d + length) / ROAD_LENGTH).setY(y);
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  return out;
}

function toGeometry(arr: number[]) {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(arr), 3));
  return g;
}

export function Road() {
  const { edges, center, curbs } = useMemo(() => {
    const steps = Math.ceil(ROAD_LENGTH / 2);
    return {
      edges: toGeometry([
        ...offsetPolyline(ROAD_HALF_WIDTH, steps),
        ...offsetPolyline(-ROAD_HALF_WIDTH, steps),
      ]),
      center: toGeometry(dashes(3, 4)),
      curbs: toGeometry([
        ...offsetPolyline(ROAD_HALF_WIDTH + SIDEWALK, steps, 0.15),
        ...offsetPolyline(-ROAD_HALF_WIDTH - SIDEWALK, steps, 0.15),
      ]),
    };
  }, []);

  useLayoutEffect(
    () => () => {
      edges.dispose();
      center.dispose();
      curbs.dispose();
    },
    [edges, center, curbs]
  );

  return (
    <group>
      <lineSegments geometry={edges} frustumCulled={false}>
        <lineBasicMaterial color={palette.green} fog />
      </lineSegments>
      <lineSegments geometry={center} frustumCulled={false}>
        <lineBasicMaterial color={palette.green} transparent opacity={0.35} fog />
      </lineSegments>
      <lineSegments geometry={curbs} frustumCulled={false}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
    </group>
  );
}
