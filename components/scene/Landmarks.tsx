"use client";

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Select } from "@react-three/postprocessing";
import { useGLTF } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  EdgesGeometry,
  MeshBasicMaterial,
  type Object3D,
  Color,
  FogExp2,
  Plane,
  Vector3,
  type Group,
  type LineBasicMaterial,
  type LineSegments,
  type Mesh,
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
 *    from the Blender model (see below), standing in the lake.
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
const WATER_Y = -0.4;

/* ------------------------------------------------------------------ */
/* Sangsad Bhaban                                                      */
/* ------------------------------------------------------------------ */

/*
 * The building is a Blender model (public/models/sangsad-bhaban.glb):
 * metres, origin at the octagon centre, detailed facade facing +X. Drawn as
 * crease edges (20 degrees) in green over faces filled with the live sky
 * colour, so back lines stay hidden and the sun sets behind the octagon.
 * Thin horizontal lines every 1.5 m around every mass read as the marble
 * strips in Kahn's concrete.
 */
const MODEL_URL = "/models/sangsad-bhaban.glb";
/** Fits the finale framing (the model is ~150 m across, 47 m to the top). */
const MODEL_SCALE = 0.72;
/** Turns the model's +X facade toward the Contact camera across the lake. */
const MODEL_YAW = Math.atan2(TO_BUILDING.z, -TO_BUILDING.x);
const EDGE_ANGLE = 20;
const BAND_STEP = 1.5;

type SangsadParts = { fills: BufferGeometry[]; edges: BufferGeometry; bands: BufferGeometry };

/** Segments where the plane y = h cuts a triangle soup (non-indexed positions). */
function sliceAt(pos: ArrayLike<number>, h: number, out: number[]) {
  for (let i = 0; i < pos.length; i += 9) {
    const pts: number[][] = [];
    for (let k = 0; k < 3; k++) {
      const a = [pos[i + k * 3], pos[i + k * 3 + 1], pos[i + k * 3 + 2]];
      const b = [pos[i + ((k + 1) % 3) * 3], pos[i + ((k + 1) % 3) * 3 + 1], pos[i + ((k + 1) % 3) * 3 + 2]];
      if ((a[1] - h) * (b[1] - h) < 0) {
        const t = (h - a[1]) / (b[1] - a[1]);
        pts.push([a[0] + (b[0] - a[0]) * t, h, a[2] + (b[2] - a[2]) * t]);
      }
    }
    if (pts.length === 2) out.push(...pts[0], ...pts[1]);
  }
}

function buildSangsadParts(root: Object3D): SangsadParts {
  root.updateMatrixWorld(true);
  const fills: BufferGeometry[] = [];
  const edgeArr: number[] = [];
  const bandArr: number[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    fills.push(g);
    const edges = new EdgesGeometry(g, EDGE_ANGLE);
    edgeArr.push(...(edges.attributes.position.array as Float32Array));
    edges.dispose();
    // Marble strips: slice this mass every 1.5 m.
    const soup = g.index ? g.toNonIndexed() : g;
    const pos = soup.attributes.position.array as ArrayLike<number>;
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    for (let h = bb.min.y + BAND_STEP; h < bb.max.y - 0.2; h += BAND_STEP) sliceAt(pos, h, bandArr);
    if (soup !== g) soup.dispose();
  });
  const lines = (arr: number[]) => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(arr), 3));
    return geo;
  };
  return { fills, edges: lines(edgeArr), bands: lines(bandArr) };
}

function SangsadBhaban() {
  const { scene } = useGLTF(MODEL_URL);
  const parts = useMemo(() => buildSangsadParts(scene), [scene]);
  useLayoutEffect(
    () => () => {
      parts.fills.forEach((g) => g.dispose());
      parts.edges.dispose();
      parts.bands.dispose();
    },
    [parts]
  );
  // One fill material shared by every mass, updated through a mesh ref.
  const fillMat = useMemo(
    () =>
      new MeshBasicMaterial({ color: palette.bgNight, fog: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    []
  );
  useLayoutEffect(() => () => fillMat.dispose(), [fillMat]);
  const fillMesh = useRef<Mesh>(null);
  const reflEdge = useRef<LineBasicMaterial>(null);
  const reflBand = useRef<LineBasicMaterial>(null);

  useFrame(() => {
    // Faces take the background colour (it shifts to dawn with the sky).
    if (fillMesh.current) (fillMesh.current.material as MeshBasicMaterial).color.copy(SKY);
    const d = dawnAmount(contactPhase(scrollStore.progress));
    if (reflEdge.current) reflEdge.current.opacity = 0.16 + 0.12 * d;
    if (reflBand.current) reflBand.current.opacity = 0.05 + 0.04 * d;
  });

  return (
    <group position={SANGSAD_POSITION} rotation-y={MODEL_YAW} scale={MODEL_SCALE}>
      {parts.fills.map((g, i) => (
        <mesh key={i} ref={i === 0 ? fillMesh : undefined} geometry={g} material={fillMat} />
      ))}
      <lineSegments geometry={parts.edges}>
        <lineBasicMaterial color={palette.green} fog />
      </lineSegments>
      <lineSegments geometry={parts.bands}>
        <lineBasicMaterial color={palette.green} transparent opacity={0.3} depthWrite={false} fog />
      </lineSegments>
      {/* Mirror image in the lake, under the water surface. */}
      <group position-y={(2 * WATER_Y) / MODEL_SCALE} scale={[1, -1, 1]}>
        <lineSegments geometry={parts.edges}>
          <lineBasicMaterial ref={reflEdge} color={palette.green} transparent opacity={0.16} depthWrite={false} fog />
        </lineSegments>
        <lineSegments geometry={parts.bands}>
          <lineBasicMaterial ref={reflBand} color={palette.green} transparent opacity={0.05} depthWrite={false} fog />
        </lineSegments>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);

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
      {/* The model loads on its own; nothing else waits for it. */}
      <Suspense fallback={null}>
        <SangsadBhaban />
      </Suspense>
      <ShaheedMinar />
    </>
  );
}
