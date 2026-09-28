"use client";

import { useLayoutEffect, useMemo } from "react";
import { Line, Text } from "@react-three/drei";
import { Select } from "@react-three/postprocessing";
import { BufferAttribute, BufferGeometry, Color } from "three";
import { palette } from "@/lib/palette";
import { roadCurve, roadFrame } from "@/lib/road";

/*
 * Neon gate arching over the road at the entrance to the tech stack. The
 * camera passes under it on the way to the first hold. Posts stand 8.75 m
 * from the road center (the camera path keeps to within 0.11 m of it here),
 * in front of the shop fronts.
 */
const GATE_A = 0.39;
const POST = 8.75;
const BEAM_Y = 10.2;
const BEAM_H = 2.4;
const ARCH_TOP = 15;
const FONT = "/fonts/geist-mono-600.woff";
const CORE = new Color(palette.green).lerp(new Color("#ffffff"), 0.7);

export function TechGate() {
  const center = useMemo(() => roadFrame(GATE_A, 0, 0), []);
  // Local +Z faces the approaching camera (back along the road).
  const yaw = useMemo(() => {
    const t = roadCurve.getTangentAt(GATE_A);
    return Math.atan2(-t.x, -t.z);
  }, []);

  const frame = useMemo(() => {
    const pts: number[] = [];
    const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
    for (const x of [-POST, POST]) {
      for (const dz of [-0.35, 0.35]) seg([x, 0, dz], [x, BEAM_Y + BEAM_H / 2, dz]);
      seg([x, BEAM_Y + BEAM_H / 2, -0.35], [x, BEAM_Y + BEAM_H / 2, 0.35]);
      for (let y = 2; y < BEAM_Y; y += 2) seg([x, y, -0.35], [x, y, 0.35]);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    return g;
  }, []);
  useLayoutEffect(() => () => frame.dispose(), [frame]);

  // Arch from post top to post top, peaking above the beam.
  const arch = useMemo(() => {
    const out: [number, number, number][] = [];
    const y0 = BEAM_Y + BEAM_H / 2;
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const x = -POST + 2 * POST * t;
      out.push([x, y0 + (ARCH_TOP - y0) * Math.sin(Math.PI * t), 0.02]);
    }
    return out;
  }, []);
  const beam = useMemo(() => {
    const w = POST - 0.4;
    const y0 = BEAM_Y - BEAM_H / 2;
    const y1 = BEAM_Y + BEAM_H / 2;
    return [
      [-w, y0, 0.03], [w, y0, 0.03], [w, y0, 0.03], [w, y1, 0.03],
      [w, y1, 0.03], [-w, y1, 0.03], [-w, y1, 0.03], [-w, y0, 0.03],
    ] as [number, number, number][];
  }, []);

  return (
    <group position={center} rotation-y={yaw}>
      <lineSegments geometry={frame}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
      {/* Neon parts are kept out of bloom: sharp tubes, soft outline halo. */}
      <Select enabled>
        <mesh position={[0, BEAM_Y, 0]}>
          <planeGeometry args={[2 * POST - 0.8, BEAM_H]} />
          <meshBasicMaterial color={palette.bgNight} transparent opacity={0.9} fog />
        </mesh>
        <Line points={arch} lineWidth={2.2} color={palette.green} />
        <Line points={beam} segments lineWidth={1.6} color={palette.green} />
        <Text
          font={FONT}
          fontSize={1.45}
          letterSpacing={0.08}
          color={CORE}
          outlineWidth={0.05}
          outlineColor={palette.green}
          outlineBlur={0.2}
          anchorX="center"
          anchorY="middle"
          position={[0, BEAM_Y + 0.05, 0.05]}
        >
          MY TECH STACK
        </Text>
        {/* Small plate hanging below the beam. */}
        <group position={[0, BEAM_Y - BEAM_H / 2 - 0.75, 0.04]}>
          <mesh>
            <planeGeometry args={[9.6, 0.9]} />
            <meshBasicMaterial color={palette.bgNight} fog />
          </mesh>
          <Line
            points={[
              [-4.8, -0.45, 0.01], [4.8, -0.45, 0.01], [4.8, -0.45, 0.01], [4.8, 0.45, 0.01],
              [4.8, 0.45, 0.01], [-4.8, 0.45, 0.01], [-4.8, 0.45, 0.01], [-4.8, -0.45, 0.01],
            ]}
            segments
            lineWidth={1}
            color={palette.green}
            transparent
            opacity={0.6}
          />
          <Text font={FONT} fontSize={0.3} color={palette.text} anchorX="center" anchorY="middle" position={[0, 0, 0.02]}>
            Tools I use to design, build and ship websites.
          </Text>
          <Line points={[[-3.2, 0.45, 0], [-3.2, 0.75, 0]]} lineWidth={1} color={palette.lineBase} />
          <Line points={[[3.2, 0.45, 0], [3.2, 0.75, 0]]} lineWidth={1} color={palette.lineBase} />
        </group>
      </Select>
    </group>
  );
}
