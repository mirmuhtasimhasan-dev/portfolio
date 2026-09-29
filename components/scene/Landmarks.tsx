"use client";

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { easing } from "maath";
import { MAX_TURN, sangsadTurn } from "@/lib/sangsadTurn";
import { Select } from "@react-three/postprocessing";
import { useGLTF } from "@react-three/drei";
import { MODEL_URL, buildSangsadParts } from "@/lib/sangsadModel";
import { lockCursor, unlockCursor } from "@/lib/cursorStore";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  MeshBasicMaterial,
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
/** Fits the finale framing (the model is ~150 m across, 47 m to the top). */
const MODEL_SCALE = 0.95;
/** Turns the model's +X facade toward the Contact camera across the lake. */
const MODEL_YAW = Math.atan2(TO_BUILDING.z, -TO_BUILDING.x);
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
  const turnGroup = useRef<Group>(null);
  const size = useThree((st) => st.size);
  const tmp = useMemo(() => new Vector3(), []);
  const hintAt = useMemo(() => SANGSAD_POSITION.clone().setY(-2), []);

  // Drag to turn (Contact hold only). The canvas keeps vertical panning for
  // touch (pan-y), so a vertical swipe still scrolls the page and only a
  // horizontal swipe turns the building. The contact card sits above the
  // canvas and takes its own pointer events, so dragging never starts there.
  const canTurn = () => contactPhase(scrollStore.progress) > 0.3;
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (!canTurn()) return;
    e.stopPropagation();
    const ev = e.nativeEvent;
    if (ev.pointerType === "mouse") ev.preventDefault();
    const startX = ev.clientX;
    const startTarget = sangsadTurn.target;
    const perPx = MAX_TURN / (Math.min(window.innerWidth, 900) * 0.4);
    sangsadTurn.dragging = true;
    document.body.style.cursor = "grabbing";
    const move = (m: PointerEvent) => {
      if (m.pointerId !== ev.pointerId) return;
      const t = startTarget + (m.clientX - startX) * perPx;
      sangsadTurn.target = Math.max(-MAX_TURN, Math.min(MAX_TURN, t));
      if (Math.abs(m.clientX - startX) > 12) sangsadTurn.dragged = true;
    };
    const up = (u: PointerEvent) => {
      if (u.pointerId !== ev.pointerId) return;
      sangsadTurn.dragging = false;
      sangsadTurn.target = 0; // ease back to the front view
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!canTurn()) return;
    if (!sangsadTurn.dragging) document.body.style.cursor = "grab";
    lockCursor(e.eventObject, "Drag");
  };
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    if (!sangsadTurn.dragging) document.body.style.cursor = "";
    unlockCursor(e.eventObject);
  };

  useFrame(({ camera, gl }, delta) => {
    if (gl.domElement.style.touchAction !== "pan-y") gl.domElement.style.touchAction = "pan-y";
    const p = contactPhase(scrollStore.progress);
    if (!canTurn() && !sangsadTurn.dragging) sangsadTurn.target = 0;
    easing.damp(sangsadTurn, "angle", sangsadTurn.target, sangsadTurn.dragging ? 0.12 : 0.45, Math.min(delta, 0.1));
    if (turnGroup.current) turnGroup.current.rotation.y = MODEL_YAW + sangsadTurn.angle;

    // "Drag to turn" hint: under the building at the hold, gone after the first drag.
    const hint = sangsadTurn.hint;
    if (hint) {
      const o = sangsadTurn.dragged ? 0 : smoothstep01((p - 0.45) / 0.15) * (1 - smoothstep01((p - 1.02) / 0.15));
      const cur = parseFloat(hint.style.opacity || "0");
      const next = sangsadTurn.dragged ? Math.max(0, cur - delta * 1.5) : o;
      hint.style.opacity = next.toFixed(3);
      hint.style.visibility = next < 0.01 ? "hidden" : "visible";
      if (next >= 0.01) {
        tmp.copy(hintAt).project(camera);
        const x = (tmp.x * 0.5 + 0.5) * size.width;
        const y = (-tmp.y * 0.5 + 0.5) * size.height;
        hint.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + 10).toFixed(1)}px, 0) translateX(-50%)`;
      }
    }

    // Faces take the background colour (it shifts to dawn with the sky).
    if (fillMesh.current) (fillMesh.current.material as MeshBasicMaterial).color.copy(SKY);
    const d = dawnAmount(contactPhase(scrollStore.progress));
    if (reflEdge.current) reflEdge.current.opacity = 0.16 + 0.12 * d;
    if (reflBand.current) reflBand.current.opacity = 0.05 + 0.04 * d;
  });

  return (
    <group ref={turnGroup} position={SANGSAD_POSITION} rotation-y={MODEL_YAW} scale={MODEL_SCALE}>
      {/* Pointer handlers on the solid masses only (not lines or the reflection). */}
      <group onPointerDown={onDown} onPointerOver={onOver} onPointerOut={onOut}>
        {parts.fills.map((g, i) => (
          <mesh key={i} ref={i === 0 ? fillMesh : undefined} geometry={g} material={fillMat} />
        ))}
      </group>
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

/*
 * The sun (world space). It rises straight out of the lake behind the
 * octagon, clears the roof and settles in the sky just above it as the sky
 * turns to dawn. One sun only: on the water it shows as the red shimmer. A soft
 * glow (drawn without depth) backlights the building while the disc is
 * still hidden behind it.
 */
const SUN_R = 17;
/** Straight behind the octagon, seen from the Contact stop. */
const SUN_BASE = SANGSAD_POSITION.clone().addScaledVector(TO_BUILDING, 120);
const SUN_LOW = WATER_Y - SUN_R - 1;
/** Final height: the disc sits just above the octagon roof. */
const SUN_HIGH = 100;
/** Live world position of the sun (the shimmer on the water follows it). */
const SUN_WORLD = new Vector3();
const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
/** World-space clipping: the sun shows only above the water. */
const ABOVE_WATER = [new Plane(new Vector3(0, 1, 0), -WATER_Y)];

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

/** The rising sun (the only one: the lake carries its shimmer, not a mirror image). */
function Sun() {
  const group = useRef<Group>(null);
  const discMat = useRef<MeshBasicMaterial>(null);
  const haloMat = useRef<MeshBasicMaterial>(null);
  const haloTex = useDiscTexture(HALO_STOPS);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const u = sunRise(contactPhase(scrollStore.progress));
    g.visible = u > 0.001;
    if (!g.visible) return;
    const y = SUN_LOW + (SUN_HIGH - SUN_LOW) * u;
    g.position.set(SUN_BASE.x, y, SUN_BASE.z);
    g.lookAt(camera.position.x, g.position.y, camera.position.z);
    SUN_WORLD.copy(g.position);
    const k = 1;
    if (discMat.current) discMat.current.opacity = k * Math.min(1, u * 5);
    if (haloMat.current) haloMat.current.opacity = k * 0.22 * Math.min(1, u * 4) * (1 - 0.5 * ease((u - 0.8) / 0.2));
  });

  return (
    <group ref={group} visible={false}>
      {/* Glow without depth: backlights the building while the disc is behind it. */}
      <mesh renderOrder={5}>
        {/* Halo radius about 1.5x the sun's, soft and low so the disc reads crisp. */}
        <planeGeometry args={[SUN_R * 3, SUN_R * 3]} />
        <meshBasicMaterial
          ref={haloMat}
          map={haloTex}
          color={palette.red}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          fog={false}
          clippingPlanes={ABOVE_WATER}
        />
      </mesh>
      <mesh renderOrder={2}>
        <circleGeometry args={[SUN_R, 72]} />
        <meshBasicMaterial
          ref={discMat}
          color={palette.red}
          transparent
          opacity={0}
          fog={false}
          toneMapped={false}
          clippingPlanes={ABOVE_WATER}
        />
      </mesh>
    </group>
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
    // A column of red dashes from the near shore to the water under the sun.
    const toSun = new Vector3().subVectors(SUN_WORLD, ROAD_END);
    const sunDist = Math.max(20, toSun.dot(TO_BUILDING));
    const sunAcross = toSun.dot(across);
    for (let i = 0; i < SHIMMER; i++) {
      const f = (i + 0.5) / SHIMMER;
      const dist = 12 + f * (sunDist - 12);
      // Column narrows toward the sun, dashes wobble side to side.
      const width = (1 - f * 0.55) * (3 + 4 * Math.abs(Math.sin(t * 1.7 + i * 2.3)));
      const off = sunAcross * (dist / sunDist) + Math.sin(t * 0.9 + i * 1.3) * 0.9;
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
