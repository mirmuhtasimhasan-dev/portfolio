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
import { buildCable, getBazaar } from "@/lib/bazaar";
import { BILLBOARDS, WATER } from "@/lib/bridge";
import { mulberry32 } from "@/lib/random";

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

/* ---------------- 3. Credentials: a thin crane on the roof ---------------- */

const CRANE = { mast: 10, jib: 9, counter: 3, size: 0.7 };

function Crane() {
  const lot = CREDENTIALS_LOT;
  const roof = FOUNDATION_HEIGHT + CREDENTIAL_FLOOR_COUNT * FLOOR_HEIGHT;
  // At the far back corner of the roof, away from the road, the banners and
  // the card; the jib points on along the road, away from the camera.
  const base = useMemo(() => new Vector3(-lot.facadeX * 0.55, roof, lot.width / 2 - 2.2), [lot, roof]);
  const s = CRANE.size / 2;

  const mast = useGeometry(() => {
    const p: number[] = [];
    const seg = (a: number[], b: number[]) => p.push(...a, ...b);
    const corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
    for (const [x, z] of corners) seg([x, 0, z], [x, CRANE.mast, z]);
    // Zigzag bracing on every face.
    for (let y = 0; y < CRANE.mast - 0.1; y += 1.5) {
      for (let i = 0; i < 4; i++) {
        const [x0, z0] = corners[i];
        const [x1, z1] = corners[(i + 1) % 4];
        seg([x0, y, z0], [x1, y + 1.5, z1]);
      }
    }
    // Cab and the tower top.
    seg([-s, CRANE.mast, -s], [0, CRANE.mast + 2.4, 0]);
    seg([s, CRANE.mast, s], [0, CRANE.mast + 2.4, 0]);
    return p;
  });

  // The slewing part: jib, counter-jib, ties and the hook line, along local +x.
  const top = useGeometry(() => {
    const p: number[] = [];
    const seg = (a: number[], b: number[]) => p.push(...a, ...b);
    const y = 0;
    const J = CRANE.jib;
    const C = CRANE.counter;
    // Triangular jib: two bottom chords and one top chord, braced.
    seg([-C, y, -s], [J, y, -0.1]);
    seg([-C, y, s], [J, y, 0.1]);
    seg([-C, y + 0.9, 0], [J - 1, y + 0.4, 0]);
    for (let x = -C; x < J - 1; x += 1.5) {
      seg([x, y, -s], [x + 0.75, y + 0.9 - (0.5 * (x + C)) / (J + C), 0]);
      seg([x, y, s], [x + 0.75, y + 0.9 - (0.5 * (x + C)) / (J + C), 0]);
    }
    // Ties from the tower top to the jib and the counter-jib.
    seg([0, 2.4, 0], [J * 0.7, y + 0.5, 0]);
    seg([0, 2.4, 0], [-C, y + 0.9, 0]);
    // Counterweight block.
    for (const [a, b] of [[-C, -C + 1.4]]) {
      seg([a, y - 1, -s], [b, y - 1, -s]);
      seg([a, y - 1, s], [b, y - 1, s]);
      seg([a, y - 1, -s], [a, y, -s]);
      seg([b, y - 1, s], [b, y, s]);
    }
    // Trolley and hook line.
    seg([J * 0.55, y, 0], [J * 0.55, y - 6, 0]);
    seg([J * 0.55 - 0.3, y - 6, 0], [J * 0.55 + 0.3, y - 6, 0]);
    return p;
  });
  const dot = useGeometry(() => [0, 0, 0]);
  const slew = useRef<Group>(null);
  const light = useRef<PointsMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Turns a few degrees back and forth, very slowly.
    if (slew.current) slew.current.rotation.y = -Math.PI / 2 + 0.12 * Math.sin((t * 2 * Math.PI) / 60);
    const near = smoothstep(CREDENTIALS - 1.2, CREDENTIALS - 0.5, scrollStore.stop) * (1 - smoothstep(CREDENTIALS + 0.8, CREDENTIALS + 1.5, scrollStore.stop));
    if (light.current) light.current.opacity = near * (t % 1.8 < 0.35 ? 0.75 : 0.12);
  });

  return (
    <group position={lot.position} rotation-y={lot.yaw}>
      <group position={base}>
        <lineSegments geometry={mast}>
          <lineBasicMaterial color={DIM} fog transparent opacity={0.6} />
        </lineSegments>
        <group ref={slew} position-y={CRANE.mast}>
          <lineSegments geometry={top}>
            <lineBasicMaterial color={DIM} fog transparent opacity={0.6} />
          </lineSegments>
          <points geometry={dot} position={[CRANE.jib, 0, 0]}>
            <pointsMaterial ref={light} color={palette.red} size={4} sizeAttenuation={false} transparent opacity={0} fog={false} depthWrite={false} />
          </points>
        </group>
      </group>
    </group>
  );
}

/* ---------------- 4. Tech stack: tangled electric wires over the road ---------------- */

const WIRES = { from: 0.405, to: 0.59, lateral: 9.2, top: 13.8, minY: 12 };

function Wires() {
  const size = useThree((s) => s.size);
  const geo = useMemo(() => {
    const rnd = mulberry32(4107);
    const p: number[] = [];
    const seg = (a: Vector3, b: Vector3) => p.push(a.x, a.y, a.z, b.x, b.y, b.z);
    // Sagging wire between two pole tops; never below minY (8.5 m over the eye).
    const wire = (a: Vector3, b: Vector3, sag: number) => {
      let prev = a;
      for (let i = 1; i <= 16; i++) {
        const t = i / 16;
        const q = a.clone().lerp(b, t);
        q.y = Math.max(WIRES.minY, q.y - sag * 4 * t * (1 - t));
        seg(prev, q);
        prev = q;
      }
    };
    // Left poles: the existing cable poles in the stretch. Right poles only
    // where no shop sign stands, so no pole crosses a board.
    const left = buildCable().poles.filter((q, i) => i % 2 === 0 && inStretch(q)).map((q) => q.clone().setY(0));
    const signs = getBazaar(size.width, size.height).filter((s) => s.side === 1);
    const clear = (q: Vector3) => signs.every((s) => Math.hypot(s.position.x - q.x, s.position.z - q.z) > s.width / 2 + 2.5);
    const right: Vector3[] = [];
    for (let a = WIRES.from; a <= WIRES.to; a += 0.009) {
      const q = roadFrame(a, WIRES.lateral, 0);
      if (clear(q)) right.push(q);
    }
    const poles = [...left, ...right];
    for (const q of right) {
      seg(q, q.clone().setY(WIRES.top));
      seg(q.clone().setY(WIRES.top - 0.6).addScaledVector(alongRoadDir(q), -0.6), q.clone().setY(WIRES.top - 0.6).addScaledVector(alongRoadDir(q), 0.6));
    }
    // Left poles already rise to the cable; extend them to the wire height.
    for (const q of left) seg(q.clone().setY(7.2), q.clone().setY(WIRES.top));
    // Along each side: a few loose wires between neighbouring poles.
    for (const side of [left, right]) {
      for (let i = 0; i + 1 < side.length; i++) {
        const n = 2 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const y0 = WIRES.top - 0.2 - rnd() * 1.2;
          const y1 = WIRES.top - 0.2 - rnd() * 1.2;
          wire(side[i].clone().setY(y0), side[i + 1].clone().setY(y1), 0.6 + rnd() * 1.0);
        }
      }
    }
    // Across the road: every right pole to a left pole a little ahead or behind.
    for (const q of right) {
      const others = [...left].sort((m, n) => m.distanceTo(q) - n.distanceTo(q));
      for (const l of others.slice(0, 1 + Math.floor(rnd() * 2))) {
        wire(q.clone().setY(WIRES.top - 0.3 - rnd() * 0.5), l.clone().setY(WIRES.top - 0.3 - rnd() * 0.5), 0.8 + rnd() * 0.6);
      }
    }
    // A tangle at each pole top: small loops wound around it.
    for (const q of poles) {
      const loops = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < loops; k++) {
        const r = 0.25 + rnd() * 0.35;
        const y = WIRES.top - 0.4 - rnd() * 1.0;
        const tilt = (rnd() - 0.5) * 0.8;
        let prev: Vector3 | null = null;
        for (let i = 0; i <= 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          const v = new Vector3(q.x + Math.cos(ang) * r, y + Math.sin(ang) * r * tilt - (Math.sin(ang) > 0 ? 0 : 0.15), q.z + Math.sin(ang) * r);
          if (prev) seg(prev, v);
          prev = v;
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(p), 3));
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

/** Road fraction nearest to a ground point (sampled over the wire stretch). */
function nearestA(q: Vector3) {
  let best = Infinity;
  let bestA = 0;
  for (let a = WIRES.from - 0.02; a <= WIRES.to + 0.02; a += 0.001) {
    const r = roadFrame(a, 0, 0);
    const d = (r.x - q.x) ** 2 + (r.z - q.z) ** 2;
    if (d < best) {
      best = d;
      bestA = a;
    }
  }
  return bestA;
}
const inStretch = (q: Vector3) => {
  const a = nearestA(q);
  return a >= WIRES.from && a <= WIRES.to;
};
const alongRoadDir = (q: Vector3) => {
  const a = nearestA(q);
  return roadFrame(a + 0.001, 0, 0).sub(roadFrame(a, 0, 0)).normalize();
};

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
        <pointsMaterial ref={lamp} color={palette.window} size={3} sizeAttenuation={false} transparent opacity={0} depthWrite={false} />
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
      <Crane />
      <Wires />
      <WaterTaxi />
      <Birds />
    </Select>
  );
}
