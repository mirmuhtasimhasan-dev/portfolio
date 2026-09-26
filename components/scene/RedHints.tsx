"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Vector3,
  type LineSegments,
  type Mesh,
  type MeshBasicMaterial,
  type Points,
  type Sprite,
  type SpriteMaterial,
} from "three";
import { ROAD_LENGTH, SANGSAD_POSITION, roadCurve, roadFrame } from "@/lib/paths";
import { palette } from "@/lib/palette";
import { mulberry32 } from "@/lib/random";
import { scrollStore } from "@/lib/scrollStore";
import { horizonGlow, redGate, smoothstep } from "@/lib/timeline";

/*
 * Red hints after the hero: tail lights driving away, a blinking signal at a
 * bend, and a horizon glow that grows toward Contact (where the sun will
 * rise). All gated by redGate(), so the hero stays pure night.
 */

const RED = new Color(palette.red);

function useRadialTexture(stops: [number, string][], w = 128, h = 128, centerY = 0.5) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    const cy = h * centerY;
    const grad = g.createRadialGradient(w / 2, cy, 0, w / 2, cy, Math.min(w, h) * (centerY === 0.5 ? 0.5 : 1));
    for (const [o, col] of stops) grad.addColorStop(o, col);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    return new CanvasTexture(c);
  }, [stops, w, h, centerY]);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

const DOT_STOPS: [number, string][] = [
  [0, "rgba(255,255,255,1)"],
  [0.25, "rgba(255,255,255,0.6)"],
  [1, "rgba(255,255,255,0)"],
];

/* ---------------- Tail lights ---------------- */

const CARS = 14;
// Bangladesh drives on the left: cars moving away use the left lane.
const LANE = -2.6;
const LIGHT_GAP = 0.75;
const LIGHT_Y = 0.9;
const TRAIL = 7;
// Lights fade out completely before they get large near the camera.
const NEAR_FADE_TO = 26;
const NEAR_FADE_FROM = 48;

function TailLights() {
  const lines = useRef<LineSegments>(null);
  const points = useRef<Points>(null);
  const dot = useRadialTexture(DOT_STOPS);

  const cars = useMemo(() => {
    const r = mulberry32(42);
    return Array.from({ length: CARS }, (_, i) => ({
      a0: i / CARS + r() * 0.03,
      speed: 8 + r() * 5, // m/s
    }));
  }, []);

  const { lineGeo, pointGeo } = useMemo(() => {
    const lg = new BufferGeometry();
    const lp = new BufferAttribute(new Float32Array(CARS * 2 * 2 * 3), 3);
    const lc = new BufferAttribute(new Float32Array(CARS * 2 * 2 * 3), 3);
    lp.setUsage(DynamicDrawUsage);
    lc.setUsage(DynamicDrawUsage);
    lg.setAttribute("position", lp);
    lg.setAttribute("color", lc);
    const pg = new BufferGeometry();
    const pp = new BufferAttribute(new Float32Array(CARS * 2 * 3), 3);
    const pc = new BufferAttribute(new Float32Array(CARS * 2 * 3), 3);
    pp.setUsage(DynamicDrawUsage);
    pc.setUsage(DynamicDrawUsage);
    pg.setAttribute("position", pp);
    pg.setAttribute("color", pc);
    return { lineGeo: lg, pointGeo: pg };
  }, []);
  useLayoutEffect(
    () => () => {
      lineGeo.dispose();
      pointGeo.dispose();
    },
    [lineGeo, pointGeo]
  );

  const head = useMemo(() => new Vector3(), []);
  const tail = useMemo(() => new Vector3(), []);

  useFrame(({ clock, camera }) => {
    const L = lines.current;
    const P = points.current;
    if (!L || !P) return;
    const gate = redGate(scrollStore.progress);
    const visible = gate > 0.001;
    L.visible = visible;
    P.visible = visible;
    if (!visible) return;

    const t = clock.elapsedTime;
    const lg = L.geometry;
    const pg = P.geometry;
    const lp = lg.attributes.position.array as Float32Array;
    const lc = lg.attributes.color.array as Float32Array;
    const pp = pg.attributes.position.array as Float32Array;
    const pc = pg.attributes.color.array as Float32Array;

    cars.forEach((car, i) => {
      const a = (car.a0 + (car.speed * t) / ROAD_LENGTH) % 1;
      const aTail = Math.max(0, a - TRAIL / ROAD_LENGTH);
      // Fade in at the start of the road and out before the end.
      const ends = Math.min(1, a / 0.03) * Math.min(1, (1 - a) / 0.06);
      for (let side = 0; side < 2; side++) {
        const lat = LANE + (side === 0 ? -LIGHT_GAP : LIGHT_GAP);
        head.copy(roadFrame(a, lat, LIGHT_Y));
        const near = head.distanceTo(camera.position);
        const k = gate * ends * smoothstep(NEAR_FADE_TO, NEAR_FADE_FROM, near);
        tail.copy(roadFrame(aTail, lat, LIGHT_Y));
        const j = i * 2 + side;
        lp.set([head.x, head.y, head.z, tail.x, tail.y, tail.z], j * 6);
        lc.set([RED.r * k, RED.g * k, RED.b * k, 0, 0, 0], j * 6);
        pp.set([head.x, head.y, head.z], j * 3);
        pc.set([RED.r * k, RED.g * k, RED.b * k], j * 3);
      }
    });
    lg.attributes.position.needsUpdate = true;
    lg.attributes.color.needsUpdate = true;
    pg.attributes.position.needsUpdate = true;
    pg.attributes.color.needsUpdate = true;
  });

  return (
    <>
      <lineSegments ref={lines} geometry={lineGeo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent blending={AdditiveBlending} depthWrite={false} fog />
      </lineSegments>
      <points ref={points} geometry={pointGeo} frustumCulled={false}>
        <pointsMaterial
          vertexColors
          map={dot}
          size={0.55}
          sizeAttenuation
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          fog
        />
      </points>
    </>
  );
}

/* ---------------- Traffic signal ---------------- */

// On the left sidewalk just before the bend into the bazaar street.
const SIGNAL_A = 0.47;
const POLE_LAT = -8.2;
const ARM_LAT = -4.4;
const POLE_H = 5.8;
const SIGNAL_HIDE_NEAR = 30;
const SIGNAL_SHOW_FAR = 55;

function TrafficSignal() {
  const glow = useRef<SpriteMaterial>(null);
  const core = useRef<SpriteMaterial>(null);
  const halo = useRadialTexture(DOT_STOPS);

  const { geo, lamp } = useMemo(() => {
    const base = roadFrame(SIGNAL_A, POLE_LAT, 0);
    const top = roadFrame(SIGNAL_A, POLE_LAT, POLE_H);
    const armEnd = roadFrame(SIGNAL_A, ARM_LAT, POLE_H);
    const pts: number[] = [];
    const seg = (a: Vector3, b: Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    seg(base, top);
    seg(top, armEnd);
    // Signal head: a box hanging from the arm, three lamp rings.
    const t = roadCurve.getTangentAt(SIGNAL_A);
    const right = new Vector3(-t.z, 0, t.x);
    const hw = 0.25;
    const y0 = POLE_H - 1.4;
    const corners = [
      [-hw, -hw],
      [hw, -hw],
      [hw, hw],
      [-hw, hw],
    ].map(([u, v]) => armEnd.clone().addScaledVector(right, u).addScaledVector(t, v));
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      seg(new Vector3(a.x, POLE_H, a.z), new Vector3(b.x, POLE_H, b.z));
      seg(new Vector3(a.x, y0, a.z), new Vector3(b.x, y0, b.z));
      seg(new Vector3(a.x, y0, a.z), new Vector3(a.x, POLE_H, a.z));
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    // Red lamp on top, facing oncoming (camera) traffic.
    const lampPos = armEnd.clone().addScaledVector(t, -hw - 0.05).setY(POLE_H - 0.3);
    return { geo: g, lamp: lampPos };
  }, []);
  useLayoutEffect(() => () => geo.dispose(), [geo]);

  const sprites = useRef<(Sprite | null)[]>([]);

  useFrame(({ clock, camera }) => {
    // Small, and gone when the camera is close: never a big pink blur over text.
    const near = smoothstep(SIGNAL_HIDE_NEAR, SIGNAL_SHOW_FAR, camera.position.distanceTo(lamp));
    const gate = redGate(scrollStore.progress) * near;
    // Blink about once a second with soft edges.
    const s = Math.sin(clock.elapsedTime * Math.PI * 1.5);
    const on = gate * Math.min(1, Math.max(0, (s + 0.15) / 0.3));
    if (glow.current) glow.current.opacity = on * 0.55;
    if (core.current) core.current.opacity = on;
    sprites.current.forEach((sp) => sp && (sp.visible = gate > 0.001));
  });

  return (
    <group>
      <lineSegments geometry={geo}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
      <sprite
        ref={(sp) => {
          sprites.current[0] = sp;
        }}
        position={lamp}
        scale={1.1}
      >
        <spriteMaterial
          ref={glow}
          map={halo}
          color={palette.red}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          fog
        />
      </sprite>
      <sprite
        ref={(sp) => {
          sprites.current[1] = sp;
        }}
        position={lamp}
        scale={0.28}
      >
        <spriteMaterial
          ref={core}
          map={halo}
          color={palette.red}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          fog
        />
      </sprite>
    </group>
  );
}

/* ---------------- Horizon glow ---------------- */

const HORIZON_STOPS: [number, string][] = [
  [0, "rgba(255,255,255,1)"],
  [0.3, "rgba(255,255,255,0.45)"],
  [1, "rgba(255,255,255,0)"],
];

const GLOW_DISTANCE = 900;
const GLOW_HEIGHT = 300;

function HorizonGlow() {
  const mesh = useRef<Mesh>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  // Wide, flat ellipse: brightest at the horizon line, fading up, down and out.
  // Center on the bottom edge: brightest at the horizon, fading up and sideways.
  const tex = useRadialTexture(HORIZON_STOPS, 256, 256, 1);
  const dir = useMemo(() => new Vector3(), []);

  useFrame(({ camera }) => {
    const k = horizonGlow(scrollStore.progress);
    if (!mesh.current || !mat.current) return;
    mesh.current.visible = k > 0.002;
    mat.current.opacity = k;
    if (k <= 0.002) return;
    // Sits on the horizon behind Sangsad Bhaban, always far away.
    dir.set(SANGSAD_POSITION.x - camera.position.x, 0, SANGSAD_POSITION.z - camera.position.z).normalize();
    mesh.current.position.set(
      camera.position.x + dir.x * GLOW_DISTANCE,
      GLOW_HEIGHT / 2, // bottom edge on the ground line at the horizon
      camera.position.z + dir.z * GLOW_DISTANCE
    );
    mesh.current.lookAt(camera.position.x, mesh.current.position.y, camera.position.z);
  });

  return (
    <mesh ref={mesh} renderOrder={-1} visible={false}>
      <planeGeometry args={[2400, GLOW_HEIGHT]} />
      <meshBasicMaterial
        ref={mat}
        map={tex}
        color={palette.red}
        transparent
        opacity={0}
        blending={AdditiveBlending}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

export function RedHints() {
  return (
    <>
      <HorizonGlow />
      <TailLights />
      <TrafficSignal />
    </>
  );
}
