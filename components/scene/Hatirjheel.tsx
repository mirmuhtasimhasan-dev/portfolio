"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Line, Text, useTexture } from "@react-three/drei";
import { useRouter } from "next/navigation";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import type { Line2, LineSegments2 } from "three-stdlib";
import {
  ALL_PROJECTS_SIGN,
  BILLBOARD,
  BILLBOARDS,
  BRIDGE_FROM,
  BRIDGE_TO,
  DECK_HALF,
  GANTRY_A,
  GANTRY_EYE,
  RAIL_H,
  WATER,
  type BillboardSpec,
} from "@/lib/bridge";
import { bazaarStore } from "@/lib/bazaarStore";
import { palette } from "@/lib/palette";
import { ROAD_LENGTH, roadCurve, roadFrame } from "@/lib/road";
import { projectStore } from "@/lib/projectStore";
import { scrollToSection } from "@/lib/scrollNav";
import { projectSectionId, sectionIndex } from "@/lib/sections";
import { smoothstep } from "@/lib/timeline";
import { scrollStore } from "@/lib/scrollStore";
import { WetReflection } from "./WetRoad";

const FONT = "/fonts/geist-mono-600.woff";
const GREEN = new Color(palette.green);
const RED = new Color(palette.red);
const TEXT = new Color(palette.text);
type FatLine = Line2 | LineSegments2;
type TroikaText = Mesh & { fillOpacity: number; text: string; color: Color | string; sync: () => void };

const rectPoints = (w: number, h: number, z = 0.02): [number, number, number][] => [
  [-w / 2, -h / 2, z], [w / 2, -h / 2, z],
  [w / 2, -h / 2, z], [w / 2, h / 2, z],
  [w / 2, h / 2, z], [-w / 2, h / 2, z],
  [-w / 2, h / 2, z], [-w / 2, -h / 2, z],
];

function lines(arr: number[]) {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(arr), 3));
  return g;
}

function useLineGeometry(build: () => number[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(() => lines(build()), []);
  useLayoutEffect(() => () => g.dispose(), [g]);
  return g;
}

const push = (arr: number[], a: Vector3, b: Vector3) => arr.push(a.x, a.y, a.z, b.x, b.y, b.z);

/** Polyline along the road at a lateral offset and height, as segment pairs. */
function alongRoad(arr: number[], from: number, to: number, lateral: number, y: number, step = 1.5) {
  const n = Math.max(2, Math.ceil(((to - from) * ROAD_LENGTH) / step));
  let prev = roadFrame(from, lateral, y);
  for (let i = 1; i <= n; i++) {
    const p = roadFrame(from + ((to - from) * i) / n, lateral, y);
    push(arr, prev, p);
    prev = p;
  }
}

/* ---------------- Water ---------------- */

function Water() {
  const geo = useMemo(() => {
    const n = 120;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = WATER.from + ((WATER.to - WATER.from) * i) / n;
      const l = roadFrame(a, -WATER.halfWidth, WATER.y);
      const r = roadFrame(a, WATER.halfWidth, WATER.y);
      pos.push(l.x, l.y, l.z, r.x, r.y, r.z);
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    return g;
  }, []);
  useLayoutEffect(() => () => geo.dispose(), [geo]);

  // Faint ripples: short lines along the current, never under the deck.
  const ripples = useLineGeometry(() => {
    const arr: number[] = [];
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const a = WATER.from + (WATER.to - WATER.from) * r();
      const side = r() < 0.5 ? -1 : 1;
      const lat = side * (DECK_HALF + 3 + r() * (WATER.halfWidth - DECK_HALF - 8));
      const len = (2 + r() * 7) / ROAD_LENGTH;
      alongRoad(arr, a, Math.min(WATER.to, a + len), lat, WATER.y + 0.02, 4);
    }
    return arr;
  });

  const water = useMemo(() => new Color(palette.bgNight).lerp(new Color(palette.bgDawn), 0.35), []);
  return (
    <group>
      <mesh geometry={geo} renderOrder={-2}>
        <meshBasicMaterial color={water} fog />
      </mesh>
      <lineSegments geometry={ripples}>
        <lineBasicMaterial color={palette.green} transparent opacity={0.12} fog />
      </lineSegments>
    </group>
  );
}

/* ---------------- Bridge ---------------- */

const PIER_EVERY = 24;
const LAMP_EVERY = 20;
/** Lamp posts never stand in front of (or right behind) a billboard. */
const nearBillboard = (a: number) => BILLBOARDS.some((b) => Math.abs(b.a - a) * ROAD_LENGTH < 14);

function Bridge() {
  const from = BRIDGE_FROM;
  const to = BRIDGE_TO;

  // Deck edges and fascia: the landmark lines, in green.
  const deck = useLineGeometry(() => {
    const arr: number[] = [];
    for (const s of [-1, 1]) {
      alongRoad(arr, from, to, s * DECK_HALF, 0.02);
      alongRoad(arr, from, to, s * DECK_HALF, -0.9);
    }
    for (const a of [from, to]) {
      push(arr, roadFrame(a, -DECK_HALF, 0.02), roadFrame(a, DECK_HALF, 0.02));
      for (const s of [-1, 1]) push(arr, roadFrame(a, s * DECK_HALF, 0.02), roadFrame(a, s * DECK_HALF, -0.9));
    }
    return arr;
  });

  // Railings, piers and lamp posts: dim structure.
  const structure = useLineGeometry(() => {
    const arr: number[] = [];
    const len = (to - from) * ROAD_LENGTH;
    for (const s of [-1, 1]) {
      alongRoad(arr, from, to, s * DECK_HALF, RAIL_H);
      for (let d = 0; d <= len; d += 2.4) {
        const a = from + d / ROAD_LENGTH;
        push(arr, roadFrame(a, s * DECK_HALF, 0.02), roadFrame(a, s * DECK_HALF, RAIL_H));
      }
    }
    // Piers: pairs of columns from the deck down into the water, braced.
    for (let d = PIER_EVERY / 2; d < len; d += PIER_EVERY) {
      const a = from + d / ROAD_LENGTH;
      for (const s of [-1, 1]) push(arr, roadFrame(a, s * 6.5, -0.9), roadFrame(a, s * 6.5, WATER.y));
      push(arr, roadFrame(a, -6.5, -1.4), roadFrame(a, 6.5, -1.4));
    }
    // Hatirjheel-style lamps: tall posts, arms curving out over the road.
    for (let d = LAMP_EVERY / 2, i = 0; d < len; d += LAMP_EVERY, i++) {
      const a = from + d / ROAD_LENGTH;
      if (nearBillboard(a)) continue;
      const s = i % 2 === 0 ? -1 : 1;
      const base = roadFrame(a, s * DECK_HALF, 0);
      const top = roadFrame(a, s * DECK_HALF, 8);
      push(arr, base, top);
      let prev = top;
      for (let k = 1; k <= 6; k++) {
        const t = k / 6;
        const p = roadFrame(a, s * (DECK_HALF - 2.4 * t), 8 + 0.8 * Math.sin(t * Math.PI * 0.8));
        push(arr, prev, p);
        prev = p;
      }
    }
    return arr;
  });

  // Reflections of the deck and railing in the water, very faint.
  const reflection = useLineGeometry(() => {
    const arr: number[] = [];
    const mirror = (y: number) => 2 * WATER.y - y;
    for (const s of [-1, 1]) {
      alongRoad(arr, from, to, s * DECK_HALF, mirror(0.02), 3);
      alongRoad(arr, from, to, s * DECK_HALF, mirror(RAIL_H), 3);
    }
    return arr;
  });

  const lamps = useMemo(() => {
    const out: Vector3[] = [];
    const len = (to - from) * ROAD_LENGTH;
    for (let d = LAMP_EVERY / 2, i = 0; d < len; d += LAMP_EVERY, i++) {
      const a = from + d / ROAD_LENGTH;
      if (nearBillboard(a)) continue;
      const s = i % 2 === 0 ? -1 : 1;
      out.push(roadFrame(a, s * (DECK_HALF - 2.4), 8.55));
    }
    return out;
  }, [from, to]);

  const dim = useMemo(() => new Color(palette.lineBase).lerp(GREEN, 0.25), []);
  return (
    <group>
      <lineSegments geometry={deck}>
        <lineBasicMaterial color={palette.green} fog />
      </lineSegments>
      <lineSegments geometry={structure}>
        <lineBasicMaterial color={dim} fog />
      </lineSegments>
      <lineSegments geometry={reflection}>
        <lineBasicMaterial color={palette.green} transparent opacity={0.1} fog />
      </lineSegments>
      {lamps.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.16, 8, 6]} />
          <meshBasicMaterial color={palette.window} fog />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- Gantry sign ---------------- */

/** "Map scale" for the gantry distances: 1 world metre reads as 20 m. */
const MAP_SCALE = 20;
const ROW_H = 0.78;
const HEAD_H = 1.1;
const GANTRY_W = 10;
const GANTRY_TOP = 12.2;
const GANTRY_POST = 10.6;
const EXIT_TAB = { w: 2.3, h: 0.7 };

const roadSamples = Array.from({ length: 2001 }, (_, i) => roadCurve.getPointAt(i / 2000));

function Arrow({ dir, x, y, size, color }: { dir: "up" | "right"; x: number; y: number; size: number; color: string }) {
  const s = size / 2;
  const pts: [number, number, number][] =
    dir === "up"
      ? [[x, y - s, 0.03], [x, y + s, 0.03], [x - s * 0.7, y + s * 0.2, 0.03], [x, y + s, 0.03], [x, y + s, 0.03], [x + s * 0.7, y + s * 0.2, 0.03]]
      : [[x - s, y, 0.03], [x + s, y, 0.03], [x + s * 0.2, y + s * 0.7, 0.03], [x + s, y, 0.03], [x + s, y, 0.03], [x + s * 0.2, y - s * 0.7, 0.03]];
  return <Line points={pts} segments lineWidth={2.2} color={color} />;
}

function GantryRow({ spec, y }: { spec: BillboardSpec; y: number }) {
  const name = useRef<TroikaText>(null);
  const dist = useRef<TroikaText>(null);
  const bar = useRef<MeshBasicMaterial>(null);
  const hit = useRef<MeshBasicMaterial>(null);
  const shown = useRef("");
  const hovered = useRef(false);
  const camIdx = useRef(0);

  useFrame(({ camera }) => {
    // Camera's position along the road (local search from the last index).
    let best = camIdx.current;
    let bd = Infinity;
    for (let i = Math.max(0, best - 80); i <= Math.min(2000, best + 80); i++) {
      const p = roadSamples[i];
      const d = (p.x - camera.position.x) ** 2 + (p.z - camera.position.z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (bd > 400) {
      // Far off the road (the hero sky view): full search.
      for (let i = 0; i <= 2000; i += 1) {
        const p = roadSamples[i];
        const d = (p.x - camera.position.x) ** 2 + (p.z - camera.position.z) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    }
    camIdx.current = best;
    const metres = Math.max(0, (spec.holdA - best / 2000) * ROAD_LENGTH);
    const km = (metres * MAP_SCALE) / 1000;
    const label = `${km < 0.05 ? "0.0" : km.toFixed(1)} km`;
    const arrived = label === "0.0 km";
    if (label !== shown.current && dist.current) {
      shown.current = label;
      dist.current.text = label;
      dist.current.sync();
    }
    const hot = arrived ? 1 : 0;
    if (name.current) name.current.color = hot ? palette.green : palette.text;
    if (dist.current) dist.current.color = hot ? palette.green : palette.text;
    if (bar.current) bar.current.opacity = hot;
    if (hit.current) hit.current.opacity = hovered.current ? 0.08 : 0;
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hovered.current = true;
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    hovered.current = false;
    document.body.style.cursor = "";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    scrollToSection(sectionIndex(projectSectionId(spec.project.slug)), 0.5);
  };

  return (
    <group position-y={y}>
      <mesh onPointerOver={over} onPointerOut={out} onClick={click} position-z={0.01}>
        <planeGeometry args={[GANTRY_W - 0.4, ROW_H - 0.06]} />
        <meshBasicMaterial ref={hit} color={palette.text} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[-GANTRY_W / 2 + 0.32, 0, 0.02]}>
        <planeGeometry args={[0.1, ROW_H * 0.62]} />
        <meshBasicMaterial ref={bar} color={palette.green} transparent opacity={0} depthWrite={false} />
      </mesh>
      <Text ref={name} font={FONT} fontSize={0.46} color={palette.text} anchorX="left" anchorY="middle" position={[-GANTRY_W / 2 + 0.6, 0, 0.03]}>
        {spec.project.name}
      </Text>
      <Text ref={dist} font={FONT} fontSize={0.46} color={palette.text} anchorX="right" anchorY="middle" position={[GANTRY_W / 2 - 0.5, 0, 0.03]}>
        {"-- km"}
      </Text>
    </group>
  );
}

function Gantry() {
  const n = BILLBOARDS.length;
  const h = 0.4 + HEAD_H + ROW_H * (n + 1) + 0.3;
  const holdCam = useMemo(() => roadFrame(GANTRY_A - 0.034, 0, GANTRY_EYE), []);
  const center = useMemo(() => roadFrame(GANTRY_A, 0, GANTRY_TOP - h / 2), [h]);
  const yaw = useMemo(() => Math.atan2(holdCam.x - center.x, holdCam.z - center.z), [holdCam, center]);
  const allHit = useRef<MeshBasicMaterial>(null);
  const allHover = useRef(false);
  const router = useRouter();

  const frame = useLineGeometry(() => {
    const arr: number[] = [];
    // Beam high enough to clear the exit tab on top of the sign.
    const beamY = GANTRY_TOP + 1.1;
    for (const s of [-1, 1]) {
      push(arr, roadFrame(GANTRY_A, s * GANTRY_POST, 0), roadFrame(GANTRY_A, s * GANTRY_POST, beamY + 0.9));
      push(arr, roadFrame(GANTRY_A + 0.6 / ROAD_LENGTH, s * GANTRY_POST, 0), roadFrame(GANTRY_A + 0.6 / ROAD_LENGTH, s * GANTRY_POST, beamY + 0.9));
    }
    // Truss beam across the road.
    for (const y of [beamY, beamY + 0.9]) push(arr, roadFrame(GANTRY_A, -GANTRY_POST, y), roadFrame(GANTRY_A, GANTRY_POST, y));
    const k = 10;
    for (let i = 0; i < k; i++) {
      const l0 = -GANTRY_POST + (2 * GANTRY_POST * i) / k;
      const l1 = -GANTRY_POST + (2 * GANTRY_POST * (i + 1)) / k;
      push(arr, roadFrame(GANTRY_A, l0, i % 2 ? beamY : beamY + 0.9), roadFrame(GANTRY_A, l1, i % 2 ? beamY + 0.9 : beamY));
    }
    // Hangers from the beam to the board.
    // Hangers clear of the exit tab (right corner).
    for (const u of [-GANTRY_W * 0.3, GANTRY_W * 0.18]) push(arr, roadFrame(GANTRY_A, u, beamY), roadFrame(GANTRY_A, u, GANTRY_TOP));
    return arr;
  });

  const fill = useMemo(() => new Color(palette.bgNight).lerp(GREEN, 0.3), []);
  const top = h / 2;
  const headY = top - 0.4 - HEAD_H / 2;
  const rowY = (i: number) => top - 0.4 - HEAD_H - ROW_H * (i + 0.5);

  useFrame(() => {
    if (allHit.current) allHit.current.opacity = allHover.current ? 0.1 : 0;
  });

  return (
    <group>
      {/* The gantry sign mirrored on the wet road below it. */}
      <WetReflection position={center} yaw={yaw} width={GANTRY_W} height={h} opacity={0.1} />
      <lineSegments geometry={frame}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
      <group position={center} rotation-y={yaw}>
        <mesh>
          <planeGeometry args={[GANTRY_W, h]} />
          <meshBasicMaterial color={fill} fog />
        </mesh>
        <Line points={rectPoints(GANTRY_W - 0.24, h - 0.24)} segments lineWidth={2} color={palette.text} />
        <Text font={FONT} fontSize={0.62} letterSpacing={0.06} color={palette.text} anchorX="left" anchorY="middle" position={[-GANTRY_W / 2 + 0.6, headY, 0.03]}>
          PROJECTS
        </Text>
        <Arrow dir="up" x={-GANTRY_W / 2 + 4.45} y={headY} size={0.62} color={palette.text} />
        <Text font={FONT} fontSize={0.44} color={palette.text} anchorX="left" anchorY="middle" position={[-GANTRY_W / 2 + 5.1, headY, 0.03]}>
          Things I shipped
        </Text>
        {/* Exit tab on top of the right corner, like a real highway sign. */}
        <group position={[GANTRY_W / 2 - EXIT_TAB.w / 2, h / 2 + EXIT_TAB.h / 2 - 0.06, -0.005]}>
          <mesh>
            <planeGeometry args={[EXIT_TAB.w, EXIT_TAB.h]} />
            <meshBasicMaterial color={fill} fog />
          </mesh>
          <Line
            points={[
              [-EXIT_TAB.w / 2 + 0.12, -EXIT_TAB.h / 2 + 0.06, 0.02],
              [-EXIT_TAB.w / 2 + 0.12, EXIT_TAB.h / 2 - 0.12, 0.02],
              [-EXIT_TAB.w / 2 + 0.12, EXIT_TAB.h / 2 - 0.12, 0.02],
              [EXIT_TAB.w / 2 - 0.12, EXIT_TAB.h / 2 - 0.12, 0.02],
              [EXIT_TAB.w / 2 - 0.12, EXIT_TAB.h / 2 - 0.12, 0.02],
              [EXIT_TAB.w / 2 - 0.12, -EXIT_TAB.h / 2 + 0.06, 0.02],
            ]}
            segments
            lineWidth={2}
            color={palette.text}
          />
          <Text font={FONT} fontSize={0.34} letterSpacing={0.08} color={palette.text} anchorX="center" anchorY="middle" position={[0, 0.0, 0.03]}>
            EXIT 05
          </Text>
        </group>
        <Line points={[[-GANTRY_W / 2 + 0.4, headY - HEAD_H / 2 + 0.05, 0.03], [GANTRY_W / 2 - 0.4, headY - HEAD_H / 2 + 0.05, 0.03]]} lineWidth={1} color={palette.text} transparent opacity={0.4} />
        {BILLBOARDS.map((b, i) => (
          <GantryRow key={b.project.slug} spec={b} y={rowY(i)} />
        ))}
        <group position-y={rowY(n)}>
          <mesh
            position-z={0.01}
            onPointerOver={(e) => {
              e.stopPropagation();
              allHover.current = true;
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              allHover.current = false;
              document.body.style.cursor = "";
            }}
            onClick={(e) => {
              e.stopPropagation();
              router.push("/projects");
            }}
          >
            <planeGeometry args={[GANTRY_W - 0.4, ROW_H - 0.06]} />
            <meshBasicMaterial ref={allHit} color={palette.text} transparent opacity={0} depthWrite={false} />
          </mesh>
          <Text font={FONT} fontSize={0.42} color={palette.text2} anchorX="left" anchorY="middle" position={[-GANTRY_W / 2 + 0.6, 0, 0.03]}>
            All projects
          </Text>
          <Arrow dir="right" x={-GANTRY_W / 2 + 4.3} y={0} size={0.46} color={palette.text2} />
        </group>
      </group>
    </group>
  );
}

/* ---------------- Billboards ---------------- */

function Screenshot({ spec }: { spec: BillboardSpec }) {
  const tex = useTexture(spec.project.image, (t) => {
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
  });
  const { w, h, strip } = BILLBOARD;
  return (
    <mesh position={[0, strip / 2, 0.015]}>
      <planeGeometry args={[w - 0.3, h - strip - 0.3]} />
      {/* Dimmed to just under the bloom threshold: a bright site never glares
          or blooms, while the green frame around it glows softly. */}
      <meshBasicMaterial map={tex} color="#969696" toneMapped={false} fog />
    </mesh>
  );
}

function Billboard({ spec }: { spec: BillboardSpec }) {
  const { w, h, strip } = BILLBOARD;
  const frame = useRef<FatLine>(null);
  const glow = useRef<FatLine>(null);
  const hot = useRef(0);
  const color = useMemo(() => new Color(), []);

  const legs = useLineGeometry(() => {
    const arr: number[] = [];
    const c = Math.cos(spec.yaw);
    const s = Math.sin(spec.yaw);
    for (const u of [-w * 0.34, w * 0.34]) {
      const x = spec.position.x + u * c;
      const z = spec.position.z - u * s;
      arr.push(x, WATER.y, z, x, spec.position.y - h / 2, z);
    }
    return arr;
  });

  useFrame(({ clock }, delta) => {
    const hovered = projectStore.hovered === spec.project.slug;
    hot.current += ((hovered ? 1 : 0) - hot.current) * Math.min(1, delta * 10);
    const litAt = bazaarStore.lit[spec.project.slug];
    const lit = litAt === undefined ? 0 : 0.4 + 0.6 * (1 - smoothstep(0, 1.2, clock.elapsedTime - litAt));
    // Hover: a glow around the frame, turning slightly red; the frame stays green.
    const fm = frame.current?.material;
    if (fm) fm.color.copy(GREEN).lerp(TEXT, 0.25 * lit + 0.15 * hot.current);
    const gm = glow.current?.material;
    if (gm) {
      color.copy(GREEN).lerp(RED, hot.current > lit ? 0.75 : 0);
      gm.color.copy(color);
      gm.opacity = Math.max(0.55 * hot.current, 0.45 * lit);
    }
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    projectStore.hovered = spec.project.slug;
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    if (projectStore.hovered === spec.project.slug) projectStore.hovered = null;
    document.body.style.cursor = "";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    projectStore.setOpen(spec.project.slug);
  };

  return (
    <group>
      <lineSegments geometry={legs}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
      <group position={spec.position} rotation-y={spec.yaw}>
        <mesh onPointerOver={over} onPointerOut={out} onClick={click}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={palette.bgNight} fog />
        </mesh>
        <Suspense fallback={null}>
          <Screenshot spec={spec} />
        </Suspense>
        <Line ref={glow} points={rectPoints(w + 0.1, h + 0.1)} segments lineWidth={9} color={palette.green} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
        <Line ref={frame} points={rectPoints(w, h)} segments lineWidth={2.2} color={palette.green} />
        <Suspense fallback={null}>
          <Text font={FONT} fontSize={0.42} color={palette.text} anchorX="left" anchorY="middle" position={[-w / 2 + 0.3, -h / 2 + strip / 2, 0.03]}>
            {spec.project.name}
          </Text>
          <Text font={FONT} fontSize={0.26} color={palette.text2} anchorX="right" anchorY="middle" position={[w / 2 - 0.3, -h / 2 + strip / 2, 0.03]}>
            {`${spec.project.year} · ${spec.project.status}`}
          </Text>
        </Suspense>
      </group>
    </group>
  );
}

/* ---------------- "All projects" neon sign at the bridge end ---------------- */

function AllProjectsSign() {
  const s = ALL_PROJECTS_SIGN;
  const glow = useRef<FatLine>(null);
  const hover = useRef(false);
  const router = useRouter();
  const legs = useLineGeometry(() => {
    const arr: number[] = [];
    const c = Math.cos(s.yaw);
    const sn = Math.sin(s.yaw);
    for (const u of [-s.w * 0.35, s.w * 0.35]) {
      const x = s.position.x + u * c;
      const z = s.position.z - u * sn;
      arr.push(x, WATER.y, z, x, s.position.y - s.h / 2, z);
    }
    return arr;
  });
  useFrame(({ clock }) => {
    const gm = glow.current?.material;
    if (gm) gm.opacity = (hover.current ? 0.55 : 0.28) + 0.06 * Math.sin(clock.elapsedTime * 2);
  });
  return (
    <group>
      <lineSegments geometry={legs}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
      <group position={s.position} rotation-y={s.yaw}>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation();
            hover.current = true;
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            hover.current = false;
            document.body.style.cursor = "";
          }}
          onClick={(e) => {
            e.stopPropagation();
            router.push("/projects");
          }}
        >
          <planeGeometry args={[s.w, s.h]} />
          <meshBasicMaterial color={palette.bgNight} fog />
        </mesh>
        <Line ref={glow} points={rectPoints(s.w, s.h)} segments lineWidth={7} color={palette.green} transparent opacity={0.28} depthWrite={false} blending={AdditiveBlending} />
        <Line points={rectPoints(s.w, s.h)} segments lineWidth={1.6} color={palette.green} />
        <Suspense fallback={null}>
          {/* "All projects" (12 chars at ~0.6 em) plus the arrow, with padding. */}
          <Text font={FONT} fontSize={0.34} color={palette.green} anchorX="left" anchorY="middle" whiteSpace="nowrap" position={[-s.w / 2 + 0.22, 0, 0.03]}>
            All projects
          </Text>
        </Suspense>
        <Arrow dir="right" x={s.w / 2 - 0.45} y={0} size={0.36} color={palette.green} />
      </group>
    </group>
  );
}

/**
 * Fades a whole group in and out from scroll (stop space), so a sign never
 * pops in or shows half-cut at the screen edge before its moment. Children
 * may animate their own opacity every frame: a change since our last write
 * is taken as the new base, then scaled by the fade.
 */
function ScrollFade({ show, children }: { show: (stop: number) => number; children: ReactNode }) {
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

const GANTRY_SECTION = sectionIndex("projects");
const LAST_BILLBOARD_SECTION = BILLBOARDS.length
  ? sectionIndex(projectSectionId(BILLBOARDS[BILLBOARDS.length - 1].project.slug))
  : GANTRY_SECTION;
/** Gantry: fades in as the camera leaves the Server roof for it. */
const gantryShow = (stop: number) => smoothstep(GANTRY_SECTION - 0.85, GANTRY_SECTION - 0.45, stop);
/** "All projects": fades in on the way into the last billboard hold. */
const endSignShow = (stop: number) => smoothstep(LAST_BILLBOARD_SECTION - 0.35, LAST_BILLBOARD_SECTION - 0.05, stop);

export function Hatirjheel() {
  return (
    <group>
      <Water />
      <Bridge />
      <ScrollFade show={gantryShow}>
        <Suspense fallback={null}>
          <Gantry />
        </Suspense>
      </ScrollFade>
      {BILLBOARDS.map((b) => (
        <Billboard key={b.project.slug} spec={b} />
      ))}
      <ScrollFade show={endSignShow}>
        <AllProjectsSign />
      </ScrollFade>
    </group>
  );
}
