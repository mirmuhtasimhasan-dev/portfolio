"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Line, Text } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Vector3,
  Line as ThreeLine,
  LineBasicMaterial,
  type Mesh,
  type MeshBasicMaterial,
  type Sprite,
  type SpriteMaterial,
} from "three";
import type { Line2, LineSegments2 } from "three-stdlib";
import {
  BILLBOARD,
  CABLE,
  buildBillboards,
  buildCable,
  getBazaar,
  type BillboardSpec,
  type SignSpec,
} from "@/lib/bazaar";
import { bazaarStore } from "@/lib/bazaarStore";
import { toolTipEls } from "@/lib/labelStore";
import { logoSegments } from "@/lib/logoLines";
import { palette } from "@/lib/palette";
import { roadFrame } from "@/lib/paths";
import { scrollStore } from "@/lib/scrollStore";
import { tick } from "@/lib/sound";
import { SIGN_DIM, SIGN_LEVEL, flickerPattern, smoothstep, toolsetPhase } from "@/lib/timeline";
import { featuredUsing, usedIn } from "@/lib/toolUsage";

const FONT = "/fonts/geist-mono-600.woff";
const GREEN = new Color(palette.green);
const BASE = new Color(palette.lineBase);

type TroikaText = Mesh & { fillOpacity: number };
type FatLine = Line2 | LineSegments2;

function useDotTexture() {
  const tex = useMemo(() => {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return new CanvasTexture(c);
  }, []);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

const rectPoints = (w: number, h: number): [number, number, number][] => [
  [-w / 2, -h / 2, 0.01],
  [w / 2, -h / 2, 0.01],
  [w / 2, -h / 2, 0.01],
  [w / 2, h / 2, 0.01],
  [w / 2, h / 2, 0.01],
  [-w / 2, h / 2, 0.01],
  [-w / 2, h / 2, 0.01],
  [-w / 2, -h / 2, 0.01],
];

/* ------------------------------------------------------------------ */
/* One sign: dim tube until the camera comes near or it is hovered,    */
/* then 2-3 tube-light flickers and steady at its level's brightness.  */
/* ------------------------------------------------------------------ */

function NeonSign({ spec, index }: { spec: SignSpec; index: number }) {
  const { tool, width: w, height: h, layout } = spec;
  const tube = useRef<FatLine>(null);
  const glow = useRef<FatLine>(null);
  const text = useRef<TroikaText>(null);
  const frame = useRef<FatLine>(null);
  const st = useRef({
    on: false,
    latched: false,
    t0: 0,
    offAt: 0,
    fromX: 0,
    x: 0,
    lastSeg: -1,
    pattern: flickerPattern(index + 1),
  });
  const lit = SIGN_LEVEL[tool.level - 1];

  // Logo placement inside the board, in board units.
  const logo = useMemo(() => {
    const raw = logoSegments(tool.logo);
    const size = layout === "row" ? h * 0.66 : w * 0.7;
    const cx = layout === "row" ? -w / 2 + h * 0.5 : 0;
    const cy = layout === "row" ? 0 : h / 2 - w * 0.55;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < raw.length; i += 3) pts.push([cx + raw[i] * size, cy + raw[i + 1] * size, 0.02]);
    return pts;
  }, [tool.logo, layout, w, h]);

  const structure = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(spec.structure), 3));
    return g;
  }, [spec.structure]);
  useLayoutEffect(() => () => structure.dispose(), [structure]);

  useFrame(({ clock }) => {
    const s = st.current;
    const now = clock.elapsedTime;
    const phase = toolsetPhase(scrollStore.progress);
    if (phase < -0.6) s.latched = false; // scrolled well back: forget hovers
    const want = phase >= spec.trigger || s.latched;

    if (want && !s.on) {
      s.on = true;
      s.t0 = now;
      s.lastSeg = -1;
    } else if (!want && s.on) {
      s.on = false;
      s.offAt = now;
      s.fromX = s.x;
    }

    if (s.on) {
      // Walk the flicker pattern: even segments on, odd segments off.
      let e = now - s.t0;
      let seg = 0;
      while (seg < s.pattern.length && e > s.pattern[seg]) e -= s.pattern[seg++];
      const onSeg = seg >= s.pattern.length || seg % 2 === 0;
      if (onSeg && seg !== s.lastSeg && seg % 2 === 0) tick();
      s.lastSeg = seg;
      s.x = onSeg ? 1 : 0.15;
    } else {
      s.x = s.fromX * Math.max(0, 1 - (now - s.offAt) / 0.25);
    }

    const hovered = bazaarStore.hovered === tool.name;
    const selected = bazaarStore.selected === tool.name;
    const b = SIGN_DIM + (lit - SIGN_DIM) * s.x;
    const tm = tube.current?.material;
    if (tm) tm.opacity = b;
    const gm = glow.current?.material;
    if (gm) gm.opacity = 0.22 * s.x * lit + (hovered ? 0.12 : 0);
    const fm = frame.current?.material;
    if (fm) {
      fm.color.copy(BASE).lerp(GREEN, selected ? 0.9 : hovered ? 0.6 : 0.25 * s.x);
      fm.opacity = 0.5 + 0.5 * s.x;
    }
    if (text.current) text.current.fillOpacity = 0.3 + 0.7 * s.x * (0.6 + 0.4 * lit);
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    st.current.latched = true;
    bazaarStore.hovered = tool.name;
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    if (bazaarStore.hovered === tool.name) bazaarStore.hovered = null;
    document.body.style.cursor = "";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    st.current.latched = true;
    bazaarStore.selected = tool.name;
    bazaarStore.pulseRequest = { tool: tool.name, at: performance.now() };
  };

  const textProps =
    layout === "row"
      ? {
          position: [-w / 2 + h * 1.02, 0, 0.02] as [number, number, number],
          fontSize: h * 0.34,
          anchorX: "left" as const,
          maxWidth: w - h * 1.15,
        }
      : {
          position: [0, -w / 2 + 0.05, 0.02] as [number, number, number],
          rotation: [0, 0, Math.PI / 2] as [number, number, number],
          fontSize: w * 0.34,
          anchorX: "center" as const,
          maxWidth: h - w - 0.2,
        };

  return (
    <group>
      <lineSegments geometry={structure}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
      <group position={spec.position} rotation-y={spec.yaw}>
        {/* Dark backing: keeps city lines out of the sign, and is the hit area. */}
        <mesh onPointerOver={over} onPointerOut={out} onClick={click}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={palette.bgNight} transparent opacity={0.92} fog />
        </mesh>
        <Line ref={frame} points={rectPoints(w, h)} segments lineWidth={1.2} color={palette.lineBase} transparent />
        <Line
          ref={glow}
          points={logo}
          segments
          lineWidth={6}
          color={palette.green}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
        />
        <Line ref={tube} points={logo} segments lineWidth={1.6} color={palette.green} transparent opacity={SIGN_DIM} />
        <Text
          ref={text}
          font={FONT}
          color={palette.text}
          anchorY="middle"
          fillOpacity={0.3}
          letterSpacing={0.02}
          {...textProps}
        >
          {tool.name}
        </Text>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Cable + red pulse                                                   */
/* ------------------------------------------------------------------ */

const PULSE_SPEED = 42; // m/s
const TRAIL_LEN = 7; // m
const TRAIL_N = 18;

function CableAndPulse({ signs }: { signs: SignSpec[] }) {
  const cable = useMemo(() => buildCable(), []);
  const dot = useDotTexture();
  const head = useRef<SpriteMaterial>(null);
  const core = useRef<SpriteMaterial>(null);
  const headSprites = useRef<(Sprite | null)[]>([]);
  const trail = useRef<ThreeLine>(null);
  const run = useRef<{ path: Vector3[]; cum: number[]; t0: number; tool: string } | null>(null);
  const tmp = useMemo(() => new Vector3(), []);

  const poles = useMemo(() => {
    const pts: number[] = [];
    for (const p of cable.poles) pts.push(p.x, 0, p.z, p.x, CABLE.height + 0.35, p.z);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    return g;
  }, [cable]);

  // The pulse's fading red tail, a plain THREE.Line (JSX <line> is SVG's).
  const trailLine = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new BufferAttribute(new Float32Array(TRAIL_N * 3), 3);
    const col = new BufferAttribute(new Float32Array(TRAIL_N * 3), 3);
    pos.setUsage(DynamicDrawUsage);
    col.setUsage(DynamicDrawUsage);
    g.setAttribute("position", pos);
    g.setAttribute("color", col);
    const m = new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false });
    const l = new ThreeLine(g, m);
    l.frustumCulled = false;
    l.visible = false;
    return l;
  }, []);
  useLayoutEffect(
    () => () => {
      poles.dispose();
      trailLine.geometry.dispose();
      (trailLine.material as LineBasicMaterial).dispose();
    },
    [poles, trailLine]
  );

  const pointAt = (path: Vector3[], cum: number[], d: number, out: Vector3) => {
    const total = cum[cum.length - 1];
    const x = Math.min(Math.max(d, 0), total);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < x) i++;
    const t = (x - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return out.copy(path[i - 1]).lerp(path[i], t);
  };

  useFrame(({ clock }) => {
    const req = bazaarStore.pulseRequest;
    if (req) {
      bazaarStore.pulseRequest = null;
      const sign = signs.find((s) => s.tool.name === req.tool);
      if (sign) {
        // Up from the sign to cable height, across the street to the cable,
        // then along the cable toward the Projects stop.
        const up = sign.anchor.clone().setY(CABLE.height);
        const across = roadFrame(Math.max(CABLE.from, sign.a), CABLE.lateral, CABLE.height);
        const along = cable.points.slice(nearestIndex(cable.points, across));
        const path = [sign.anchor.clone(), up, across, ...along];
        const cum = [0];
        for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + path[i].distanceTo(path[i - 1]));
        run.current = { path, cum, t0: clock.elapsedTime, tool: req.tool };
      }
    }

    const r = run.current;
    const visible = !!r;
    headSprites.current.forEach((sp) => sp && (sp.visible = visible));
    if (trail.current) trail.current.visible = visible;
    if (!r || !trail.current) return;

    const total = r.cum[r.cum.length - 1];
    const d = (clock.elapsedTime - r.t0) * PULSE_SPEED;
    if (d >= total + TRAIL_LEN) {
      // Arrived: light the billboards of projects that used the tool.
      bazaarStore.lit = { slugs: featuredUsing(r.tool).map((p) => p.slug), at: clock.elapsedTime };
      run.current = null;
      return;
    }
    pointAt(r.path, r.cum, d, tmp);
    const fade = 1 - smoothstep(total - 2, total + TRAIL_LEN, d);
    headSprites.current.forEach((sp) => sp && sp.position.copy(tmp));
    if (head.current) head.current.opacity = 0.8 * fade;
    if (core.current) core.current.opacity = fade;

    const tg = trail.current!.geometry;
    const pos = tg.attributes.position.array as Float32Array;
    const col = tg.attributes.color.array as Float32Array;
    const red = new Color(palette.red);
    for (let i = 0; i < TRAIL_N; i++) {
      const k = i / (TRAIL_N - 1);
      pointAt(r.path, r.cum, d - k * TRAIL_LEN, tmp);
      pos.set([tmp.x, tmp.y, tmp.z], i * 3);
      const a = (1 - k) * fade;
      col.set([red.r * a, red.g * a, red.b * a], i * 3);
    }
    tg.attributes.position.needsUpdate = true;
    tg.attributes.color.needsUpdate = true;
  });

  return (
    <group>
      <Line points={cable.points} lineWidth={1.4} color={palette.green} transparent opacity={0.28} />
      <lineSegments geometry={poles}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
      <primitive ref={trail} object={trailLine} />
      <sprite
        ref={(s) => {
          headSprites.current[0] = s;
        }}
        scale={2.6}
        visible={false}
      >
        <spriteMaterial ref={head} map={dot} color={palette.red} transparent blending={AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite
        ref={(s) => {
          headSprites.current[1] = s;
        }}
        scale={0.6}
        visible={false}
      >
        <spriteMaterial ref={core} map={dot} color={palette.red} transparent blending={AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  );
}

function nearestIndex(points: Vector3[], p: Vector3) {
  let best = 0;
  let bd = Infinity;
  points.forEach((q, i) => {
    const d = q.distanceToSquared(p);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/* ------------------------------------------------------------------ */
/* Placeholder billboards at the Projects stop (Phase 4 replaces them) */
/* ------------------------------------------------------------------ */

function Billboard({ spec }: { spec: BillboardSpec }) {
  const frame = useRef<FatLine>(null);
  const back = useRef<MeshBasicMaterial>(null);
  const name = useRef<TroikaText>(null);
  const { w, h } = BILLBOARD;

  const posts = useMemo(() => {
    const c = Math.cos(spec.yaw);
    const s = Math.sin(spec.yaw);
    const pts: number[] = [];
    for (const u of [-w * 0.3, w * 0.3]) {
      const x = spec.position.x + u * c;
      const z = spec.position.z - u * s;
      pts.push(x, 0, z, x, BILLBOARD.bottom, z);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    return g;
  }, [spec, w]);
  useLayoutEffect(() => () => posts.dispose(), [posts]);

  useFrame(({ clock }) => {
    const { slugs, at } = bazaarStore.lit;
    const on = slugs.includes(spec.slug);
    // A bright flash on arrival, then a steady glow.
    const flash = on ? 1 - smoothstep(0, 0.8, clock.elapsedTime - at) : 0;
    const x = on ? 0.7 + 0.3 * flash : 0;
    const fm = frame.current?.material;
    if (fm) {
      fm.color.copy(BASE).lerp(GREEN, x);
      fm.opacity = 0.6 + 0.4 * x;
    }
    if (back.current) back.current.color.set(palette.bgNight).lerp(GREEN, 0.1 * x);
    if (name.current) name.current.fillOpacity = 0.35 + 0.65 * x;
  });

  return (
    <group>
      <lineSegments geometry={posts}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
      <group position={spec.position} rotation-y={spec.yaw}>
        <mesh>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial ref={back} color={palette.bgNight} transparent opacity={0.92} fog />
        </mesh>
        <Line ref={frame} points={rectPoints(w, h)} segments lineWidth={2} color={palette.lineBase} transparent />
        <Text ref={name} font={FONT} fontSize={0.55} color={palette.text} position={[0, 0.3, 0.02]} anchorY="middle" fillOpacity={0.35}>
          {spec.name}
        </Text>
        <Text font={FONT} fontSize={0.28} color={palette.text2} position={[0, -0.55, 0.02]} anchorY="middle">
          {String(spec.year)}
        </Text>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */

export function NeonBazaar() {
  const signs = useMemo(() => getBazaar(), []);
  const billboards = useMemo(() => buildBillboards(), []);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const tmp = useMemo(() => new Vector3(), []);
  const shown = useRef<string | null>(null);

  // "Used in" tooltip for the hovered (or last clicked) sign.
  useFrame(() => {
    const { root, name, used } = toolTipEls;
    if (!root || !name || !used) return;
    const phase = toolsetPhase(scrollStore.progress);
    const current = phase > -0.5 && phase < 1.3 ? (bazaarStore.hovered ?? bazaarStore.selected) : null;
    const sign = current ? signs.find((s) => s.tool.name === current) : undefined;
    if (!sign) {
      root.style.visibility = "hidden";
      root.style.opacity = "0";
      return;
    }
    if (shown.current !== sign.tool.name) {
      shown.current = sign.tool.name;
      name.textContent = sign.tool.name;
      const list = usedIn(sign.tool.name).map((p) => p.name);
      used.textContent = list.length ? `Used in ${list.join(" · ")}` : "Not in a listed project yet";
    }
    tmp.copy(sign.anchor).setY(sign.anchor.y + 0.4).project(camera);
    if (tmp.z >= 1) {
      root.style.visibility = "hidden";
      return;
    }
    const x = (tmp.x * 0.5 + 0.5) * size.width;
    const y = (-tmp.y * 0.5 + 0.5) * size.height;
    root.style.visibility = "visible";
    root.style.opacity = "1";
    root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
  });

  return (
    <group>
      {signs.map((spec, i) => (
        <NeonSign key={spec.tool.name} spec={spec} index={i} />
      ))}
      <CableAndPulse signs={signs} />
      {billboards.map((b) => (
        <Billboard key={b.slug} spec={b} />
      ))}
    </group>
  );
}
