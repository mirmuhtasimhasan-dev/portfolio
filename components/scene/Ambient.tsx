"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Select } from "@react-three/postprocessing";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Vector3,
  type Group,
  type LineBasicMaterial,
  type MeshBasicMaterial,
  type PointsMaterial,
} from "three";
import { palette } from "@/lib/palette";
import { sampleCamera } from "@/lib/paths";
import { roadFrame } from "@/lib/road";
import { scrollStore } from "@/lib/scrollStore";
import { PROJECT_SECTIONS, sectionIndex } from "@/lib/sections";
import { aboutPhase, cityLit, contactPhase, smoothstep, sunRise } from "@/lib/timeline";
import {
  ABOUT_LOT,
  ABOUT_WINDOW,
  CREDENTIALS_LOT,
  CREDENTIAL_FLOOR_COUNT,
  FLOOR_HEIGHT,
  FOUNDATION_HEIGHT,
  aboutWindowLocal,
} from "@/lib/contentBuildings";
import { BILLBOARDS, WATER } from "@/lib/bridge";
import { buildWires } from "@/lib/wires";

/*
 * One small, slow, dim detail per section (SPEC.md, "Ambient details"). None of
 * them is bright or near the text: all are kept out of bloom and drawn at low
 * opacity. Desktop only, never with reduced motion (Scene mounts this).
 */

/** Dim line colour for the details: line-base with a touch of green. */
const DIM = new Color(palette.lineBase).lerp(new Color(palette.green), 0.22);

const HERO = sectionIndex("hero");
const CREDENTIALS = sectionIndex("credentials");
const TOOLSET = sectionIndex("toolset");
const ROOF = sectionIndex("roof");
const CONTACT = sectionIndex("contact");

/** A static line or point geometry, built once. */
function useGeometry(build: () => number[]) {
  const [geo] = useState(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(build()), 3));
    return g;
  });
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

/** A world point on the screen ray (ndc x, y) of a section's hold camera. */
function holdPoint(section: number, aspect: number, x: number, y: number, dist: number) {
  const pos = new Vector3();
  const look = new Vector3();
  sampleCamera(section, pos, look);
  const cam = new PerspectiveCamera(55, aspect, 1, 2000);
  cam.position.copy(pos);
  cam.lookAt(look);
  cam.updateMatrixWorld();
  const dir = new Vector3(x, y, 0.5).unproject(cam).sub(pos).normalize();
  return pos.addScaledVector(dir, dist);
}

/* ---------------- 1. Hero: a far airplane, nav lights only ---------------- */

const PLANE_CROSS = 80; // seconds per crossing

function Airplane() {
  const size = useThree((s) => s.size);
  // In the clear strip between the nav and the hero text, far away.
  const [from, to] = useMemo(() => {
    const aspect = size.width / size.height;
    return [holdPoint(HERO, aspect, -1.15, 0.79, 700), holdPoint(HERO, aspect, 1.15, 0.77, 700)];
  }, [size]);
  const heading = useMemo(() => to.clone().sub(from).normalize(), [from, to]);
  // Wing tips: left (red) and right (green), turned a little toward the camera.
  const wing = useMemo(() => new Vector3(-heading.z, 0, heading.x).applyAxisAngle(new Vector3(0, 1, 0), 0.9).multiplyScalar(9), [heading]);
  const group = useRef<Group>(null);
  const red = useRef<PointsMaterial>(null);
  const green = useRef<PointsMaterial>(null);
  const dot = useGeometry(() => [0, 0, 0]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const vis = 1 - smoothstep(HERO + 0.25, HERO + 0.7, scrollStore.stop);
    g.visible = vis > 0.01;
    if (!g.visible) return;
    const t = clock.elapsedTime;
    g.position.lerpVectors(from, to, ((t + 20) % PLANE_CROSS) / PLANE_CROSS);
    // Each light blinks briefly, out of step with the other.
    const blink = (o: number) => (((t + o) % 1.4) < 0.16 ? 0.95 : 0.45);
    if (red.current) red.current.opacity = vis * blink(0);
    if (green.current) green.current.opacity = vis * blink(0.7);
  });

  return (
    <group ref={group}>
      <points geometry={dot} position={wing.clone().negate()}>
        <pointsMaterial ref={red} color={palette.red} size={3.5} sizeAttenuation={false} transparent opacity={0} fog={false} depthWrite={false} />
      </points>
      <points geometry={dot} position={wing}>
        <pointsMaterial ref={green} color={palette.green} size={3.5} sizeAttenuation={false} transparent opacity={0} fog={false} depthWrite={false} />
      </points>
    </group>
  );
}

/* ---------------- 2. About: a ceiling fan shadow in the lit window ---------------- */

function FanShadow() {
  const lot = ABOUT_LOT;
  const o = Math.sign(lot.facadeX);
  const win = useMemo(() => aboutWindowLocal(ABOUT_WINDOW.floor, ABOUT_WINDOW.col), []);
  const spin = useRef<Group>(null);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);

  useFrame(({ clock }) => {
    const k = cityLit(aboutPhase(scrollStore.progress));
    if (spin.current) spin.current.rotation.z = clock.elapsedTime * 1.1;
    for (const m of mats.current) if (m) m.opacity = k * 0.85;
  });

  const mat = (i: number) => (
    <meshBasicMaterial
      ref={(m) => {
        mats.current[i] = m;
      }}
      color={palette.bgNight}
      transparent
      opacity={0}
      fog
      depthWrite={false}
    />
  );

  return (
    <group position={lot.position} rotation-y={lot.yaw}>
      <group position={[win.x + o * 0.03, win.y, win.z]} rotation-y={lot.facadeX > 0 ? Math.PI / 2 : -Math.PI / 2}>
        {/* Down-rod from the ceiling, then the blades seen at a slant. */}
        <mesh position={[0.05, 0.64, 0.004]} renderOrder={2}>
          <planeGeometry args={[0.03, 0.2]} />
          {mat(0)}
        </mesh>
        {/* A 1.2 m fan, blades seen from below at a slant. */}
        <group position={[0.05, 0.52, 0.004]} scale={[1, 0.34, 1]}>
          <group ref={spin}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} rotation-z={(i * 2 * Math.PI) / 3} position={[0, 0, 0]} renderOrder={2}>
                <circleGeometry args={[0.56, 16, -0.17, 0.34]} />
                {mat(i + 1)}
              </mesh>
            ))}
            <mesh renderOrder={2}>
              <circleGeometry args={[0.09, 12]} />
              {mat(4)}
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/* ---------------- 3. Credentials: a red light on the roof corner ---------------- */

function RoofLight() {
  const lot = CREDENTIALS_LOT;
  const roof = FOUNDATION_HEIGHT + CREDENTIAL_FLOOR_COUNT * FLOOR_HEIGHT;
  // The back corner of the roof at the near end: at the hold it sits at the
  // left of the building, away from the banners and the card.
  const corner = useMemo(() => new Vector3(-lot.facadeX * 0.95, roof + 0.6, -lot.width / 2 + 0.3), [lot, roof]);
  const dot = useGeometry(() => [0, 0, 0]);
  const light = useRef<PointsMaterial>(null);

  useFrame(({ clock }) => {
    const near = smoothstep(CREDENTIALS - 1.2, CREDENTIALS - 0.5, scrollStore.stop) * (1 - smoothstep(CREDENTIALS + 0.8, CREDENTIALS + 1.5, scrollStore.stop));
    if (light.current) light.current.opacity = near * (clock.elapsedTime % 1.8 < 0.5 ? 0.8 : 0.2);
  });

  return (
    <group position={lot.position} rotation-y={lot.yaw}>
      <points geometry={dot} position={corner}>
        <pointsMaterial ref={light} color={palette.red} size={4} sizeAttenuation={false} transparent opacity={0} fog={false} depthWrite={false} />
      </points>
    </group>
  );
}

/* ---------------- 4. Tech stack: tangled electric wires over the road ---------------- */

function Wires() {
  const size = useThree((s) => s.size);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(buildWires(size.width, size.height)), 3));
    return g;
  }, [size]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  const mat = useRef<LineBasicMaterial>(null);
  const group = useRef<Group>(null);

  useFrame(() => {
    const stop = scrollStore.stop;
    const vis = smoothstep(TOOLSET - 1.6, TOOLSET - 0.8, stop) * (1 - smoothstep(ROOF + 0.3, ROOF + 1, stop));
    if (group.current) group.current.visible = vis > 0.01;
    if (mat.current) mat.current.opacity = 0.75 * vis;
  });

  return (
    <group ref={group}>
      <lineSegments geometry={geo}>
        <lineBasicMaterial ref={mat} color={palette.lineBase} fog transparent opacity={0} />
      </lineSegments>
    </group>
  );
}

/* ---------------- 5. Projects: a water taxi under the bridge ---------------- */

const TAXI = { length: 6.5, width: 2, cross: 50, from: -20, to: 60 };

function WaterTaxi() {
  // Crosses under the bridge just past the first billboard, so at its hold
  // the boat runs across the water below and right of the board.
  const a = (BILLBOARDS[0]?.a ?? 0.678) + 0.004;
  const from = useMemo(() => roadFrame(a, TAXI.from, WATER.y), [a]);
  const to = useMemo(() => roadFrame(a, TAXI.to, WATER.y), [a]);
  const heading = useMemo(() => to.clone().sub(from).normalize(), [from, to]);
  const yaw = Math.atan2(-heading.z, heading.x);

  const hull = useGeometry(() => {
    const p: number[] = [];
    const seg = (a: number[], b: number[]) => p.push(...a, ...b);
    const L = TAXI.length / 2;
    const W = TAXI.width / 2;
    // Hull outline at the waterline and the gunwale, pointed bow on +x.
    const ring = (y: number, k: number) => {
      const pts = [[-L, -W * k], [L - 1.2, -W * k], [L, 0], [L - 1.2, W * k], [-L, W * k]];
      for (let i = 0; i < pts.length; i++) {
        const [x0, z0] = pts[i];
        const [x1, z1] = pts[(i + 1) % pts.length];
        seg([x0, y, z0], [x1, y, z1]);
      }
    };
    ring(0.05, 0.85);
    ring(0.45, 1);
    // Canopy: four posts and a flat roof (stays under the deck).
    const cx0 = -L + 0.6;
    const cx1 = L - 1.8;
    for (const x of [cx0, cx1]) for (const z of [-W * 0.8, W * 0.8]) seg([x, 0.45, z], [x, 0.95, z]);
    seg([cx0, 0.95, -W * 0.8], [cx1, 0.95, -W * 0.8]);
    seg([cx0, 0.95, W * 0.8], [cx1, 0.95, W * 0.8]);
    seg([cx0, 0.95, -W * 0.8], [cx0, 0.95, W * 0.8]);
    seg([cx1, 0.95, -W * 0.8], [cx1, 0.95, W * 0.8]);
    return p;
  });

  // Light trail on the water behind the boat: two faint wake lines opening
  // out from the stern, warm, fading to nothing.
  const TRAIL = 16;
  const trail = useMemo(() => {
    const g = new BufferGeometry();
    const pos: number[] = [];
    const col: number[] = [];
    const warm = new Color(palette.window);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 12; i++) {
        for (const t of [i / 12, (i + 1) / 12]) {
          pos.push(-TAXI.length / 2 - t * TRAIL, 0.02, side * (0.5 + t * 2.2));
          const k = 0.22 * (1 - t) ** 1.5;
          col.push(warm.r * k, warm.g * k, warm.b * k);
        }
      }
    }
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
    return g;
  }, []);
  useLayoutEffect(() => () => trail.dispose(), [trail]);
  const dot = useGeometry(() => [0, 0, 0]);

  const group = useRef<Group>(null);
  const lines = useRef<LineBasicMaterial>(null);
  const wake = useRef<LineBasicMaterial>(null);
  const lamp = useRef<PointsMaterial>(null);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const stop = scrollStore.stop;
    const first = PROJECT_SECTIONS[0];
    const last = PROJECT_SECTIONS[PROJECT_SECTIONS.length - 1];
    const vis = smoothstep(first - 0.6, first, stop) * (1 - smoothstep(last + 0.2, last + 0.8, stop));
    g.visible = vis > 0.01;
    if (!g.visible) return;
    const t = ((clock.elapsedTime + 16) % TAXI.cross) / TAXI.cross;
    g.position.lerpVectors(from, to, t);
    // Fades in and out at the ends of its run.
    const k = vis * smoothstep(0, 0.08, t) * (1 - smoothstep(0.92, 1, t));
    if (lines.current) lines.current.opacity = 0.75 * k;
    if (wake.current) wake.current.opacity = k;
    if (lamp.current) lamp.current.opacity = 0.55 * k;
  });

  return (
    <group ref={group} rotation-y={yaw}>
      <lineSegments geometry={hull}>
        <lineBasicMaterial ref={lines} color={DIM} fog transparent opacity={0} />
      </lineSegments>
      <lineSegments geometry={trail}>
        <lineBasicMaterial ref={wake} vertexColors transparent opacity={0} blending={AdditiveBlending} depthWrite={false} fog />
      </lineSegments>
      <points geometry={dot} position={[TAXI.length / 2 - 1.8, 0.9, 0]}>
        <pointsMaterial ref={lamp} color={palette.window} size={0.35} transparent opacity={0} depthWrite={false} />
      </points>
    </group>
  );
}

/* ---------------- 6. Contact: a small flock of birds at dawn ---------------- */

const FLOCK = [
  [0, 0], [-2.6, 1.1], [-2.3, -1.3], [-5.2, 2.0], [-4.9, -2.4], [-7.6, 0.6], [-8.4, 2.9],
] as const;
const BIRD_CROSS = 40;

function Birds() {
  const size = useThree((s) => s.size);
  const [from, to] = useMemo(() => {
    const aspect = size.width / size.height;
    // Above the octagon roof, beside the sun, well clear of the card.
    return [holdPoint(CONTACT, aspect, -1.2, 0.64, 120), holdPoint(CONTACT, aspect, 1.3, 0.72, 120)];
  }, [size]);
  const dir = useMemo(() => to.clone().sub(from).normalize(), [from, to]);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(FLOCK.length * 4 * 3), 3));
    return g;
  }, []);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  const mat = useRef<LineBasicMaterial>(null);
  const lines = useRef<Group>(null);
  const tmp = useMemo(() => new Vector3(), []);

  useFrame(({ clock }) => {
    const vis = smoothstep(0.15, 0.45, sunRise(contactPhase(scrollStore.progress))) * smoothstep(CONTACT - 0.5, CONTACT - 0.1, scrollStore.stop);
    if (lines.current) lines.current.visible = vis > 0.01;
    if (vis <= 0.01) return;
    if (mat.current) mat.current.opacity = 0.8 * vis;
    const t = clock.elapsedTime;
    const u = (t % BIRD_CROSS) / BIRD_CROSS;
    const attr = geo.getAttribute("position") as BufferAttribute;
    const span = 0.85;
    FLOCK.forEach(([dx, dy], i) => {
      tmp.lerpVectors(from, to, u).addScaledVector(dir, dx * 1.6).addScaledVector(up, dy * 1.2 + 0.25 * Math.sin(t * 0.7 + i));
      const flap = Math.sin(t * 5.5 + i * 1.7);
      const tipY = span * (0.2 + 0.45 * flap);
      const bx = tmp.x;
      const by = tmp.y;
      const bz = tmp.z;
      const o = i * 12;
      // Two wings from the body to their tips, a small "v" seen from the side.
      const a = attr.array as Float32Array;
      a.set([bx, by, bz, bx - dir.x * span, by + tipY, bz - dir.z * span], o);
      a.set([bx, by, bz, bx + dir.x * span, by + tipY, bz + dir.z * span], o + 6);
    });
    attr.needsUpdate = true;
    geo.computeBoundingSphere();
  });

  return (
    <group ref={lines}>
      <lineSegments geometry={geo} frustumCulled={false}>
        <lineBasicMaterial ref={mat} color={palette.bgNight} transparent opacity={0} fog={false} />
      </lineSegments>
    </group>
  );
}

export function Ambient() {
  return (
    <Select enabled>
      <Airplane />
      <FanShadow />
      <RoofLight />
      <Wires />
      <WaterTaxi />
      <Birds />
    </Select>
  );
}
