"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Select } from "@react-three/postprocessing";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  FogExp2,
  Plane,
  Vector3,
  type Group,
  type LineBasicMaterial,
  type LineSegments,
  type Mesh,
  type MeshBasicMaterial,
  type Points,
  type PointsMaterial,
} from "three";
import { palette } from "@/lib/palette";
import { roadCurve, roadFrame, SANGSAD_POSITION, LAKE_CENTER } from "@/lib/road";
import { scrollStore } from "@/lib/scrollStore";
import { SKY, SKY_DAWN, SKY_NIGHT } from "@/lib/sky";
import {
  contactPhase,
  dawnAmount,
  starsAmount,
  sunRise,
} from "@/lib/timeline";
import { FOG_DENSITY } from "./fog";

/*
 * Phase 6 landmarks:
 *  - Sangsad Bhaban, the Contact finale: Louis Kahn's National Assembly,
 *    built from primitives. A tall octagonal assembly block ringed by eight
 *    lower blocks, the great circular and triangular cut-outs in their
 *    facades, standing on a plinth in a lake. Green wireframe edges over a
 *    dark fill (the fill hides the sun behind it).
 *  - The lake: the building mirrored in the water, ripples, and a red
 *    shimmer under the rising sun.
 *  - The sun (#F43F5E) rising behind it, the sky shifting night to dawn,
 *    stars fading out. All from scroll (contactPhase).
 *  - Shaheed Minar: a small, far, still silhouette on the hero skyline.
 */

type Seg = number[];
const pushSeg = (arr: Seg, a: number[], b: number[]) => arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);

/** Line segments from a module-level (stable) array. */
function useLines(arr: number[]) {
  const g = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(arr), 3));
    return geo;
  }, [arr]);
  useLayoutEffect(() => () => g.dispose(), [g]);
  return g;
}

/** Road end, and the view line from the Contact stop to the building. */
const ROAD_END = roadCurve.getPointAt(1);
const CONTACT_CAM = roadFrame(0.965, 0, 6);
const TO_BUILDING = new Vector3().subVectors(SANGSAD_POSITION, CONTACT_CAM).setY(0).normalize();
/** Building yaw: its main face (local +Z) looks back at the Contact stop. */
const SANGSAD_YAW = Math.atan2(-TO_BUILDING.x, -TO_BUILDING.z);
const WATER_Y = -0.4;

/* ------------------------------------------------------------------ */
/* Sangsad Bhaban                                                      */
/* ------------------------------------------------------------------ */

const OCT_R = 19;
const OCT_H = 46;
const RING_R = 42;

type Block = { angle: number; w: number; d: number; h: number; kind: "circle" | "triangle" };

// Eight peripheral blocks around the octagon, alternating the two motifs Kahn
// cut into the facades: great circles and great triangles.
const BLOCKS: Block[] = Array.from({ length: 8 }, (_, i) => ({
  angle: (Math.PI / 4) * i + Math.PI / 8,
  w: i % 2 === 0 ? 17 : 15,
  d: i % 2 === 0 ? 15 : 13,
  h: i % 2 === 0 ? 33 : 27,
  kind: i % 2 === 0 ? "circle" : "triangle",
}));

/** Local frame of a block: its outward face normal and across direction. */
function blockFrame(b: Block) {
  const n = [Math.sin(b.angle), 0, Math.cos(b.angle)];
  const t = [Math.cos(b.angle), 0, -Math.sin(b.angle)];
  const c = [n[0] * RING_R, 0, n[2] * RING_R];
  // p(u, v, w): u across the face, v up, w outward from the block center.
  return (u: number, v: number, w: number) => [c[0] + t[0] * u + n[0] * w, v, c[2] + t[2] * u + n[2] * w];
}

function buildSangsad() {
  const edges: Seg = [];
  const detail: Seg = [];

  // Plinth in the lake: a low, wide octagon.
  const plinth = (r: number, y: number) =>
    Array.from({ length: 8 }, (_, k) => {
      const a = (Math.PI / 4) * k + Math.PI / 8;
      return [Math.sin(a) * r, y, Math.cos(a) * r];
    });
  const p0 = plinth(64, 0);
  const p1 = plinth(64, 2.2);
  for (let k = 0; k < 8; k++) {
    pushSeg(detail, p0[k], p0[(k + 1) % 8]);
    pushSeg(edges, p1[k], p1[(k + 1) % 8]);
    pushSeg(detail, p0[k], p1[k]);
  }

  // Central octagonal assembly block, with a crown ring near the top.
  const oct = (y: number, r = OCT_R) =>
    Array.from({ length: 8 }, (_, k) => {
      const a = (Math.PI / 4) * k;
      return [Math.sin(a) * r, y, Math.cos(a) * r];
    });
  const ob = oct(2.2);
  const ot = oct(OCT_H);
  const oc = oct(OCT_H - 5);
  for (let k = 0; k < 8; k++) {
    const n = (k + 1) % 8;
    pushSeg(edges, ob[k], ot[k]);
    pushSeg(edges, ot[k], ot[n]);
    pushSeg(detail, oc[k], oc[n]);
    // Tall slot openings high on each octagon face, above the ring blocks.
    const mid = (y: number, f: number) => [
      ob[k][0] + (ob[n][0] - ob[k][0]) * f,
      y,
      ob[k][2] + (ob[n][2] - ob[k][2]) * f,
    ];
    for (const f of [0.3, 0.7]) pushSeg(detail, mid(31, f), mid(OCT_H - 7, f));
    pushSeg(detail, mid(31, 0.3), mid(31, 0.7));
  }

  // Ring blocks with their cut-outs on the outward face.
  for (const b of BLOCKS) {
    const P = blockFrame(b);
    const hw = b.w / 2;
    const hd = b.d / 2;
    const corners = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
    for (let k = 0; k < 4; k++) {
      const [u0, w0] = corners[k];
      const [u1, w1] = corners[(k + 1) % 4];
      pushSeg(edges, P(u0, 2.2, w0), P(u1, 2.2, w0 === w1 ? w1 : w1));
      pushSeg(edges, P(u0, b.h, w0), P(u1, b.h, w1));
      pushSeg(edges, P(u0, 2.2, w0), P(u0, b.h, w0));
    }
    // Floor lines, faint.
    for (let y = 9; y < b.h - 2; y += 7) pushSeg(detail, P(-hw, y, hd), P(hw, y, hd));

    const face = hd + 0.05;
    const cy = b.h * 0.55;
    if (b.kind === "circle") {
      // One great circle, and a smaller one below it.
      for (const [r, y] of [
        [b.w * 0.32, cy + 2],
        [b.w * 0.12, 7],
      ] as const) {
        let prev = P(r, y, face);
        for (let s = 1; s <= 40; s++) {
          const t = (s / 40) * Math.PI * 2;
          const p = P(Math.cos(t) * r, y + Math.sin(t) * r, face);
          pushSeg(edges, prev, p);
          prev = p;
        }
      }
    } else {
      // A great triangle over a tall rectangular slot.
      const s = b.w * 0.36;
      const a = P(-s, cy - s * 0.55, face);
      const c = P(s, cy - s * 0.55, face);
      const top = P(0, cy + s * 0.95, face);
      pushSeg(edges, a, c);
      pushSeg(edges, c, top);
      pushSeg(edges, top, a);
      pushSeg(detail, P(-1.6, 3, face), P(-1.6, cy - s * 0.8, face));
      pushSeg(detail, P(1.6, 3, face), P(1.6, cy - s * 0.8, face));
      pushSeg(detail, P(-1.6, cy - s * 0.8, face), P(1.6, cy - s * 0.8, face));
    }
  }

  return { edges, detail };
}

const SANGSAD_LINES = buildSangsad();

function useSangsadFill() {
  const geos = useMemo(() => {
    const out: BufferGeometry[] = [];
    const oct = new CylinderGeometry(OCT_R * Math.cos(Math.PI / 8) * 1.0, OCT_R, OCT_H - 2.2, 8);
    oct.translate(0, (OCT_H + 2.2) / 2, 0);
    out.push(oct);
    for (const b of BLOCKS) {
      const box = new BoxGeometry(b.w, b.h - 2.2, b.d);
      box.translate(0, (b.h + 2.2) / 2, 0);
      box.rotateY(b.angle);
      box.translate(Math.sin(b.angle) * RING_R, 0, Math.cos(b.angle) * RING_R);
      out.push(box);
    }
    const plinth = new CylinderGeometry(64, 64, 2.2, 8);
    plinth.rotateY(Math.PI / 8);
    plinth.translate(0, 1.1, 0);
    out.push(plinth);
    return out;
  }, []);
  useLayoutEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return geos;
}

function SangsadBhaban() {
  const edgeGeo = useLines(SANGSAD_LINES.edges);
  const detailGeo = useLines(SANGSAD_LINES.detail);
  const fills = useSangsadFill();
  const fill = useMemo(() => new Color(palette.bgNight).lerp(new Color(palette.bgDawn), 0.35), []);
  const dim = useMemo(() => new Color(palette.lineBase).lerp(new Color(palette.green), 0.45), []);
  const reflEdge = useRef<LineBasicMaterial>(null);
  const reflDetail = useRef<LineBasicMaterial>(null);

  useFrame(() => {
    // The reflection brightens a little as the sky lightens.
    const d = dawnAmount(contactPhase(scrollStore.progress));
    if (reflEdge.current) reflEdge.current.opacity = 0.16 + 0.12 * d;
    if (reflDetail.current) reflDetail.current.opacity = 0.08 + 0.06 * d;
  });

  return (
    <group position={SANGSAD_POSITION} rotation-y={SANGSAD_YAW}>
      {fills.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color={fill} fog polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        </mesh>
      ))}
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={palette.green} fog />
      </lineSegments>
      <lineSegments geometry={detailGeo}>
        <lineBasicMaterial color={dim} fog />
      </lineSegments>
      {/* Mirror image in the lake, under the water surface. */}
      <group position-y={2 * WATER_Y} scale={[1, -1, 1]}>
        <lineSegments geometry={edgeGeo}>
          <lineBasicMaterial ref={reflEdge} color={palette.green} transparent opacity={0.16} depthWrite={false} fog />
        </lineSegments>
        <lineSegments geometry={detailGeo}>
          <lineBasicMaterial ref={reflDetail} color={palette.green} transparent opacity={0.08} depthWrite={false} fog />
        </lineSegments>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Lake, sun, red shimmer                                              */
/* ------------------------------------------------------------------ */

/** Sun sits far behind the building, a little toward the hoist like the flag's disc. */
const SUN_DIST = 120;
const SUN_R = 26;
const SUN_BASE = SANGSAD_POSITION.clone()
  .addScaledVector(TO_BUILDING, SUN_DIST)
  .addScaledVector(new Vector3(-TO_BUILDING.z, 0, TO_BUILDING.x), -14);
const SUN_LOW = -SUN_R * 1.3;
// Final height: the disc clears the roofline, its lower edge just behind the
// top of the assembly block (green field, red disc: the flag).
const SUN_HIGH = 88;
/** Only the part above the horizon shows (the ground is not solid). */
const ABOVE_HORIZON = [new Plane(new Vector3(0, 1, 0), 0)];

function useDiscTexture(stops: [number, string][]) {
  const tex = useMemo(() => {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) grad.addColorStop(o, col);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return new CanvasTexture(c);
  }, [stops]);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

const HALO_STOPS: [number, string][] = [
  [0, "rgba(255,255,255,0.9)"],
  [0.3, "rgba(255,255,255,0.35)"],
  [1, "rgba(255,255,255,0)"],
];

function Sun() {
  const disc = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const discMat = useRef<MeshBasicMaterial>(null);
  const haloMat = useRef<MeshBasicMaterial>(null);
  const haloTex = useDiscTexture(HALO_STOPS);

  useFrame(({ camera }) => {
    const r = sunRise(contactPhase(scrollStore.progress));
    const y = SUN_LOW + (SUN_HIGH - SUN_LOW) * r;
    for (const m of [disc.current, halo.current]) {
      if (!m) continue;
      m.visible = r > 0.001;
      m.position.set(SUN_BASE.x, y, SUN_BASE.z);
      m.lookAt(camera.position.x, y, camera.position.z);
    }
    if (discMat.current) discMat.current.opacity = Math.min(1, r * 4);
    if (haloMat.current) haloMat.current.opacity = 0.55 * Math.min(1, r * 3);
  });

  return (
    <>
      <mesh ref={halo} visible={false} renderOrder={-3}>
        <planeGeometry args={[SUN_R * 6, SUN_R * 6]} />
        <meshBasicMaterial
          ref={haloMat}
          map={haloTex}
          color={palette.red}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          fog={false}
          clippingPlanes={ABOVE_HORIZON}
        />
      </mesh>
      <mesh ref={disc} visible={false} renderOrder={-2}>
        <circleGeometry args={[SUN_R, 64]} />
        <meshBasicMaterial
          ref={discMat}
          color={palette.red}
          transparent
          opacity={0}
          fog={false}
          toneMapped={false}
          clippingPlanes={ABOVE_HORIZON}
        />
      </mesh>
    </>
  );
}

/** Ripples: short lines across the view, faint. */
const RIPPLES = (() => {
  const arr: number[] = [];
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const across = new Vector3(-TO_BUILDING.z, 0, TO_BUILDING.x);
  for (let i = 0; i < 220; i++) {
    const d = 8 + r() * 200;
    const u = (r() - 0.5) * 300;
    const len = 2 + r() * 6;
    const p = ROAD_END.clone().addScaledVector(TO_BUILDING, d).addScaledVector(across, u);
    const q = p.clone().addScaledVector(across, len);
    arr.push(p.x, WATER_Y + 0.05, p.z, q.x, WATER_Y + 0.05, q.z);
  }
  return arr;
})();

const LAKE_R = 230;
const LAKE_C = LAKE_CENTER.clone().lerp(SANGSAD_POSITION, 0.55);
const SHIMMER = 34;

function Lake() {
  const surface = useRef<MeshBasicMaterial>(null);
  const shimmer = useRef<LineSegments>(null);
  const shimmerMat = useRef<LineBasicMaterial>(null);
  const water = useMemo(() => new Color(), []);

  const ripples = useLines(RIPPLES);

  // Red shimmer: short horizontal dashes on the water under the sun, from the
  // shore toward the building. Positions animate a little (the water moves).
  const shimmerGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(SHIMMER * 6), 3));
    return g;
  }, []);
  useLayoutEffect(() => () => shimmerGeo.dispose(), [shimmerGeo]);

  useFrame(({ clock }) => {
    const p = contactPhase(scrollStore.progress);
    const r = sunRise(p);
    const d = dawnAmount(p);
    // Water darkens toward the sky colour, a touch lighter at dawn.
    water.copy(SKY).lerp(new Color(palette.bgDawn), 0.3 + 0.2 * d);
    if (surface.current) surface.current.color.copy(water);
    const line = shimmer.current;
    if (!line || !shimmerMat.current) return;
    line.visible = r > 0.05;
    shimmerMat.current.opacity = 0.75 * smoothstep01((r - 0.2) / 0.5);
    if (!line.visible) return;
    const arr = line.geometry.attributes.position.array as Float32Array;
    const across = new Vector3(-TO_BUILDING.z, 0, TO_BUILDING.x);
    const t = clock.elapsedTime;
    const sunAcross = new Vector3().subVectors(SUN_BASE, ROAD_END).dot(across);
    for (let i = 0; i < SHIMMER; i++) {
      const f = (i + 0.5) / SHIMMER;
      const dist = 12 + f * 150;
      // Column narrows toward the far shore, dashes wobble side to side.
      const width = (1 - f * 0.65) * (4 + 5 * Math.abs(Math.sin(t * 1.7 + i * 2.3)));
      const off = sunAcross * (dist / (SUN_DIST + 180)) + Math.sin(t * 0.9 + i * 1.3) * 1.2;
      const c = ROAD_END.clone().addScaledVector(TO_BUILDING, dist).addScaledVector(across, off);
      const a = c.clone().addScaledVector(across, -width / 2);
      const b = c.clone().addScaledVector(across, width / 2);
      arr.set([a.x, WATER_Y + 0.08, a.z, b.x, WATER_Y + 0.08, b.z], i * 6);
    }
    line.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group>
      {/* Semi-transparent surface drawn over the mirrored building. */}
      <mesh position={[LAKE_C.x, WATER_Y, LAKE_C.z]} rotation-x={-Math.PI / 2} renderOrder={2}>
        <circleGeometry args={[LAKE_R, 64]} />
        <meshBasicMaterial ref={surface} color={palette.bgNight} transparent opacity={0.55} depthWrite={false} fog />
      </mesh>
      <lineSegments geometry={ripples} renderOrder={3}>
        <lineBasicMaterial color={palette.green} transparent opacity={0.1} fog />
      </lineSegments>
      <lineSegments ref={shimmer} geometry={shimmerGeo} frustumCulled={false} renderOrder={3} visible={false}>
        <lineBasicMaterial
          ref={shimmerMat}
          color={palette.red}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </lineSegments>
    </group>
  );
}

const smoothstep01 = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------ */
/* Stars and the sky shift                                             */
/* ------------------------------------------------------------------ */

const STARS = 700;

function Stars() {
  const points = useRef<Points>(null);
  const mat = useRef<PointsMaterial>(null);
  const geo = useMemo(() => {
    let seed = 5;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pos = new Float32Array(STARS * 3);
    for (let i = 0; i < STARS; i++) {
      // Upper sky only (8 to 80 degrees above the horizon).
      const az = r() * Math.PI * 2;
      const el = (8 + Math.pow(r(), 0.7) * 72) * (Math.PI / 180);
      pos.set([Math.cos(el) * Math.cos(az) * 1000, Math.sin(el) * 1000, Math.cos(el) * Math.sin(az) * 1000], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    return g;
  }, []);
  useLayoutEffect(() => () => geo.dispose(), [geo]);

  useFrame(({ camera }) => {
    const k = starsAmount(contactPhase(scrollStore.progress));
    if (points.current) {
      points.current.visible = k > 0.01;
      points.current.position.copy(camera.position);
    }
    if (mat.current) mat.current.opacity = 0.55 * k;
  });

  return (
    <points ref={points} geometry={geo} frustumCulled={false} renderOrder={-5}>
      <pointsMaterial
        ref={mat}
        color={palette.text}
        size={1.4}
        sizeAttenuation={false}
        transparent
        opacity={0.55}
        depthWrite={false}
        fog={false}
      />
    </points>
  );
}

/** Background, fog colour and fog density follow the Contact dawn. */
function SkyShift() {
  useFrame(({ gl, scene }) => {
    gl.localClippingEnabled = true;
    if (scene.background !== SKY) scene.background = SKY;
    const d = dawnAmount(contactPhase(scrollStore.progress));
    SKY.copy(SKY_NIGHT).lerp(SKY_DAWN, d);
    const fog = scene.fog as FogExp2 | null;
    if (fog) {
      fog.color.copy(SKY);
      // Clearer dawn air, so the building across the lake reads.
      fog.density = FOG_DENSITY * (1 - 0.35 * d);
    }
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Shaheed Minar: hero skyline silhouette                              */
/* ------------------------------------------------------------------ */

/** Far beyond the city, left of the hero's line of sight, on the horizon. */
const MINAR_POS = new Vector3(-470, 0, -880);
const MINAR_SCALE = 3.2;

/**
 * The Central Shaheed Minar's real shape, in outline: a tall central frame
 * whose top bends forward (the mother bowing), and two shorter frames on each
 * side, set slightly forward and turned in, on a stepped platform. Grill bars
 * inside each frame. Still, dim, no colour, no effects.
 */
function buildMinar() {
  const arr: Seg = [];
  const frame = (cx: number, z: number, w: number, h: number, yaw: number, bars: number, bend = 0) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const P = (u: number, y: number, dz = 0) => [cx + u * c + dz * s, y, z - u * s + dz * c];
    const bendLen = bend ? h * 0.3 : 0;
    const hTop = h - bendLen;
    const tipY = hTop + bendLen * Math.cos(0.6);
    const tipZ = bendLen * Math.sin(0.6);
    for (const u of [-w / 2, w / 2]) {
      pushSeg(arr, P(u, 0), P(u, hTop));
      if (bend) pushSeg(arr, P(u, hTop), P(u, tipY, tipZ));
    }
    pushSeg(arr, P(-w / 2, hTop), P(w / 2, hTop));
    if (bend) pushSeg(arr, P(-w / 2, tipY, tipZ), P(w / 2, tipY, tipZ));
    for (let k = 1; k <= bars; k++) {
      const u = -w / 2 + (w * k) / (bars + 1);
      pushSeg(arr, P(u, h * 0.12), P(u, hTop - h * 0.04));
      if (bend) pushSeg(arr, P(u, hTop), P(u, tipY, tipZ));
    }
  };
  frame(0, 0, 7, 16, 0, 4, 1);
  frame(-7.2, 1.6, 4.6, 11, 0.22, 3);
  frame(7.2, 1.6, 4.6, 11, -0.22, 3);
  frame(-12.6, 3.6, 4.2, 8.5, 0.42, 2);
  frame(12.6, 3.6, 4.2, 8.5, -0.42, 2);
  // Stepped platform.
  for (const [w, y, d] of [
    [34, 0, 10],
    [30, 0.6, 8],
  ] as const) {
    pushSeg(arr, [-w / 2, y, -d / 2 + 2], [w / 2, y, -d / 2 + 2]);
    pushSeg(arr, [-w / 2, y, d / 2 + 2], [w / 2, y, d / 2 + 2]);
  }
  return arr;
}

const MINAR_LINES = buildMinar();

function ShaheedMinar() {
  const geo = useLines(MINAR_LINES);
  const group = useRef<Group>(null);
  // Faces the hero camera (it is only ever seen from there).
  const yaw = useMemo(() => Math.atan2(0 - MINAR_POS.x, 108 - MINAR_POS.z), []);
  const color = useMemo(() => new Color(palette.lineBase).lerp(new Color(palette.text2), 0.42), []);
  return (
    <Select enabled>
      <group ref={group} position={MINAR_POS} rotation-y={yaw} scale={MINAR_SCALE}>
        <lineSegments geometry={geo}>
          <lineBasicMaterial color={color} fog={false} />
        </lineSegments>
      </group>
    </Select>
  );
}

export function Landmarks() {
  return (
    <>
      <SkyShift />
      <Stars />
      <Sun />
      <Lake />
      <SangsadBhaban />
      <ShaheedMinar />
    </>
  );
}
