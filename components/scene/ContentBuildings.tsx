"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  EdgesGeometry,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  Vector3,
  type Group,
  type LineBasicMaterial,
  type LineSegments,
  type MeshBasicMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ABOUT_COLS,
  ABOUT_LOT,
  ABOUT_WINDOW,
  BALCONY_DEPTH,
  CREDENTIAL_FLOOR_COUNT,
  CREDENTIALS_LOT,
  FLOOR_HEIGHT,
  FOUNDATION_HEIGHT,
  aboutWindowLocal,
  credentialFloorBase,
  type ContentLot,
} from "@/lib/contentBuildings";
import { getDhakaHouse } from "@/lib/dhakaHouse";
import { aboutCardEls, credentialLabelEls } from "@/lib/labelStore";
import { palette } from "@/lib/palette";
import { scrollStore } from "@/lib/scrollStore";
import {
  ABOUT_SNIPPET,
  ABOUT_TIMING,
  CREDENTIALS_TIMING,
  aboutCard,
  aboutCursorOnLastLine,
  aboutLabel,
  aboutLeader,
  aboutLine1,
  aboutLine2,
  aboutPhase,
  aboutTyped,
  cityLit,
  credentialsPhase,
  floorLight,
  smoothstep,
} from "@/lib/timeline";

// Content buildings are the only bright green buildings; their details are a
// dimmer green so the outline still reads first.
const DETAIL_COLOR = new Color(palette.lineBase).lerp(new Color(palette.green), 0.35);

function useLines(arr: Float32Array) {
  const g = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(arr, 3));
    return geo;
  }, [arr]);
  useLayoutEffect(() => () => g.dispose(), [g]);
  return g;
}

/** Facade plane rotation so a PlaneGeometry (facing +Z) faces the road. */
const facadeRotation = (lot: ContentLot): [number, number, number] => [
  0,
  lot.facadeX > 0 ? Math.PI / 2 : -Math.PI / 2,
  0,
];

/** Soft radial falloff, white in the middle; tinted by the material color. */
function useGlowTexture() {
  const tex = useMemo(() => {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return new CanvasTexture(c);
  }, []);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** Soft light spill: brightest at the top edge, fading down and sideways. */
function useSpillTexture() {
  const tex = useMemo(() => {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(size / 2, 0, 0, size / 2, 0, size);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return new CanvasTexture(c);
  }, []);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/**
 * A person at a desk with a laptop, as flat dark shapes in the window's plane
 * (x across the window, y up; window is 1.8 x 1.5). Shape only, no detail.
 */
function useSilhouette() {
  return useMemo(() => {
    const body = new Shape();
    // Shoulders and back, seated, facing the laptop on the left.
    body.moveTo(0.52, -0.46);
    body.lineTo(0.2, -0.46);
    body.lineTo(0.2, -0.2);
    body.quadraticCurveTo(0.22, -0.06, 0.33, -0.05);
    body.quadraticCurveTo(0.47, -0.05, 0.5, -0.18);
    body.lineTo(0.52, -0.46);
    const person = new ShapeGeometry(body, 8);
    const head = new CircleGeometry(0.1, 20);
    head.translate(0.32, 0.1, 0);
    const desk = new PlaneGeometry(1.5, 0.05);
    desk.translate(-0.05, -0.49, 0);
    // Laptop in profile: base on the desk, screen tilted toward the person.
    const base = new PlaneGeometry(0.34, 0.025);
    base.translate(-0.12, -0.455, 0);
    const lid = new PlaneGeometry(0.028, 0.27);
    lid.rotateZ(-0.28);
    lid.translate(-0.3, -0.33, 0);
    // Same attribute layout for every part so they merge into one geometry.
    const parts = [person, head, desk, base, lid].map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      n.deleteAttribute("normal");
      n.deleteAttribute("uv");
      return n;
    });
    return mergeGeometries(parts)!;
  }, []);
}

/* ------------------------------------------------------------------ */
/* About: a Mohammadpur house with the one window that stays on.       */
/* ------------------------------------------------------------------ */

function AboutHouse() {
  const lot = ABOUT_LOT;
  const house = getDhakaHouse();
  const outline = useLines(house.outline);
  const detail = useLines(house.detail);
  const glow = useGlowTexture();
  const glass = useRef<MeshBasicMaterial>(null);
  const halo = useRef<MeshBasicMaterial>(null);
  const laptop = useRef<MeshBasicMaterial>(null);
  const figure = useRef<MeshBasicMaterial>(null);
  const wallSpill = useRef<MeshBasicMaterial>(null);
  const floorSpill = useRef<MeshBasicMaterial>(null);
  const spill = useSpillTexture();
  const silhouette = useSilhouette();
  useLayoutEffect(() => () => silhouette.dispose(), [silhouette]);
  const group = useRef<Group>(null);
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  const o = Math.sign(lot.facadeX);
  const win = useMemo(() => aboutWindowLocal(ABOUT_WINDOW.floor, ABOUT_WINDOW.col), []);
  const anchor = useMemo(() => win.clone().setX(win.x + o * 0.1), [win, o]);
  const tmp = useMemo(() => new Vector3(), []);
  const typedRef = useRef(-1);
  const cardH = useRef(0);
  const codeY = useRef(0);
  // The balcony next to the window on the same floor (middle column).
  const balcony = useMemo(() => {
    const colW = lot.width / ABOUT_COLS;
    return {
      x: lot.facadeX + o * (BALCONY_DEPTH / 2),
      y: ABOUT_WINDOW.floor * FLOOR_HEIGHT + 0.07,
      z: -lot.width / 2 + colW * 1.5,
      w: BALCONY_DEPTH,
      d: 3,
    };
  }, [lot, o]);
  // House outline corners (balconies included), to keep the card beside it.
  const corners = useMemo(() => {
    const hx = lot.depth / 2 + BALCONY_DEPTH;
    const hz = lot.width / 2;
    const out: Vector3[] = [];
    for (const x of [-hx, hx]) for (const y of [0, lot.top]) for (const z of [-hz, hz]) out.push(new Vector3(x, y, z));
    return out;
  }, [lot]);

  useFrame(({ clock }) => {
    const p = aboutPhase(scrollStore.progress);
    const lit = cityLit(p);
    const card = aboutCard(p);
    // The laptop glows brighter while the card types.
    const scr = smoothstep(ABOUT_TIMING.typeFrom - 0.04, ABOUT_TIMING.typeFrom, p) * (1 - smoothstep(1.02, 1.25, p));
    if (glass.current) glass.current.opacity = lit;
    if (halo.current) halo.current.opacity = lit * (0.3 + 0.3 * scr);
    if (figure.current) figure.current.opacity = lit * 0.96;
    if (laptop.current) laptop.current.opacity = lit * (0.35 + 0.45 * scr);
    // Warm light from the window on the wall below and the balcony beside it.
    if (wallSpill.current) wallSpill.current.opacity = lit * 0.2;
    if (floorSpill.current) floorSpill.current.opacity = lit * 0.28;

    const els = aboutCardEls;
    if (!els.root || !els.code || !els.leader || !els.dot || !group.current) return;
    tmp.copy(anchor);
    group.current.localToWorld(tmp).project(camera);
    const vis = tmp.z < 1 ? card : 0;
    els.root.style.opacity = vis.toFixed(3);
    els.root.style.visibility = vis < 0.01 ? "hidden" : "visible";
    const showLeader = vis >= 0.01;
    els.leader.setAttribute("visibility", showLeader ? "visible" : "hidden");
    els.dot.setAttribute("visibility", showLeader ? "visible" : "hidden");
    if (els.spark) els.spark.setAttribute("visibility", "hidden");
    if (vis < 0.01) return;

    const W = size.width;
    const H = size.height;
    const wx = (tmp.x * 0.5 + 0.5) * W;
    const wy = (-tmp.y * 0.5 + 0.5) * H;

    // Left edge of the house on screen: the card sits clear of it.
    let houseMinX = Infinity;
    for (const c of corners) {
      tmp.copy(c);
      group.current.localToWorld(tmp).project(camera);
      if (tmp.z < 1) houseMinX = Math.min(houseMinX, (tmp.x * 0.5 + 0.5) * W);
    }
    const cardW = els.root.offsetWidth;
    if (!cardH.current) cardH.current = els.root.offsetHeight;
    if (!codeY.current && els.codeRow) codeY.current = els.codeRow.offsetTop + els.codeRow.offsetHeight / 2;
    const right = Math.min(wx - 70, houseMinX - 36);
    const left = Math.max(24, right - cardW);
    const top = Math.min(Math.max(wy - 44, 96), H - cardH.current - 32);
    els.root.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;

    // Leader: from the window to the card's right edge at the code line,
    // drawing itself out from the window as the card arrives.
    const ex = left + cardW;
    const ey = top + (codeY.current || 60);
    const k = aboutLeader(p);
    els.leader.setAttribute("x1", wx.toFixed(1));
    els.leader.setAttribute("y1", wy.toFixed(1));
    els.leader.setAttribute("x2", (wx + (ex - wx) * k).toFixed(1));
    els.leader.setAttribute("y2", (wy + (ey - wy) * k).toFixed(1));
    els.leader.setAttribute("stroke-opacity", (0.85 * vis).toFixed(3));
    els.dot.setAttribute("cx", wx.toFixed(1));
    els.dot.setAttribute("cy", wy.toFixed(1));
    els.dot.setAttribute("fill-opacity", vis.toFixed(3));

    // Once the line is fully drawn, a small light runs from window to card on a loop.
    if (els.spark && k >= 0.999) {
      const t = (clock.elapsedTime * 0.45) % 1;
      els.spark.setAttribute("visibility", "visible");
      els.spark.setAttribute("cx", (wx + (ex - wx) * t).toFixed(1));
      els.spark.setAttribute("cy", (wy + (ey - wy) * t).toFixed(1));
      els.spark.setAttribute("fill-opacity", (vis * Math.sin(Math.PI * t)).toFixed(3));
    }

    const n = Math.round(aboutTyped(p) * ABOUT_SNIPPET.length);
    if (n !== typedRef.current) {
      typedRef.current = n;
      els.code.textContent = ABOUT_SNIPPET.slice(0, n);
    }
    const reveal = (el: HTMLElement | null, v: number) => {
      if (!el) return;
      el.style.opacity = v.toFixed(3);
      el.style.transform = `translateY(${((1 - v) * 6).toFixed(1)}px)`;
    };
    reveal(els.label, aboutLabel(p));
    reveal(els.line1, aboutLine1(p));
    reveal(els.line2, aboutLine2(p));
    // The cursor moves to the end of "I never put it down." once it is in.
    const onLast = aboutCursorOnLastLine(p);
    if (els.cursor1) els.cursor1.style.visibility = onLast ? "hidden" : "visible";
    if (els.cursor2) els.cursor2.style.visibility = onLast ? "visible" : "hidden";
  });

  return (
    <group ref={group} position={lot.position} rotation-y={lot.yaw}>
      <lineSegments geometry={outline}>
        <lineBasicMaterial color={palette.green} fog />
      </lineSegments>
      <lineSegments geometry={detail}>
        <lineBasicMaterial color={DETAIL_COLOR} fog />
      </lineSegments>
      <group position={[win.x + o * 0.03, win.y, win.z]} rotation={facadeRotation(lot)}>
        <mesh renderOrder={1}>
          <planeGeometry args={[ABOUT_WINDOW.width, ABOUT_WINDOW.height]} />
          <meshBasicMaterial ref={glass} color={palette.window} transparent opacity={0} fog depthWrite={false} />
        </mesh>
        {/* Someone at a desk with a laptop, as a dark silhouette. */}
        <mesh geometry={silhouette} position-z={0.006} renderOrder={2}>
          <meshBasicMaterial ref={figure} color={palette.bgNight} transparent opacity={0} fog depthWrite={false} />
        </mesh>
        {/* Laptop glow on the face and the desk. */}
        <mesh position={[-0.05, -0.3, 0.01]} renderOrder={3}>
          <planeGeometry args={[0.8, 0.55]} />
          <meshBasicMaterial
            ref={laptop}
            map={glow}
            color={palette.text}
            transparent
            opacity={0}
            fog
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
        {/* Warm spill on the wall below the window, leaning toward the balcony. */}
        <mesh position={[-0.5, -ABOUT_WINDOW.height / 2 - 1.2, 0.015]} renderOrder={3}>
          <planeGeometry args={[3.4, 2.4]} />
          <meshBasicMaterial
            ref={wallSpill}
            map={spill}
            color={palette.window}
            transparent
            opacity={0}
            fog
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
        <mesh position-z={0.02} renderOrder={4}>
          <planeGeometry args={[5, 4.4]} />
          <meshBasicMaterial
            ref={halo}
            map={glow}
            color={palette.window}
            transparent
            opacity={0}
            fog
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
      {/* Warm spill on the balcony floor beside the window, brightest on the window side. */}
      <mesh position={[balcony.x, balcony.y, balcony.z]} rotation-x={-Math.PI / 2} renderOrder={3}>
        <planeGeometry args={[balcony.w, balcony.d]} />
        <meshBasicMaterial
          ref={floorSpill}
          map={spill}
          color={palette.window}
          transparent
          opacity={0}
          fog
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Credentials: the building draws itself, floor by floor.             */
/* ------------------------------------------------------------------ */

type AnimatedSeg = { a: Vector3; b: Vector3; t0: number; t1: number };

function credentialSegments(lot: ContentLot): AnimatedSeg[] {
  const hx = lot.depth / 2;
  const hz = lot.width / 2;
  const fx = lot.facadeX;
  const o = Math.sign(fx);
  const segs: AnimatedSeg[] = [];
  const { starts, draw } = CREDENTIALS_TIMING;

  for (let k = 0; k < CREDENTIAL_FLOOR_COUNT; k++) {
    const y0 = credentialFloorBase(k);
    const y1 = y0 + FLOOR_HEIGHT;
    const floor: [Vector3, Vector3][] = [];
    // Corner posts grow upward, then the slab edges, then the windows.
    for (const [x, z] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) {
      floor.push([new Vector3(x, y0, z), new Vector3(x, y1, z)]);
    }
    const ring: [number, number][] = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = ring[i];
      const [x1, z1] = ring[(i + 1) % 4];
      floor.push([new Vector3(x0, y1, z0), new Vector3(x1, y1, z1)]);
    }
    const colW = lot.width / 3;
    for (let c = 0; c < 3; c++) {
      const zc = -hz + colW * (c + 0.5);
      const wx = fx + o * 0.02;
      const a0 = y0 + 0.9;
      const a1 = y0 + 2.4;
      const p = [
        new Vector3(wx, a0, zc - 1),
        new Vector3(wx, a0, zc + 1),
        new Vector3(wx, a1, zc + 1),
        new Vector3(wx, a1, zc - 1),
      ];
      for (let i = 0; i < 4; i++) floor.push([p[i], p[(i + 1) % 4]]);
    }
    const n = floor.length;
    floor.forEach(([a, b], i) => {
      const t0 = starts[k] + draw * (i / n) * 0.75;
      segs.push({ a, b, t0, t1: t0 + draw * 0.25 });
    });
  }
  return segs;
}

function CredentialsBuilding() {
  const lot = CREDENTIALS_LOT;
  const o = Math.sign(lot.facadeX);
  const bands = useRef<(MeshBasicMaterial | null)[]>([]);
  const rings = useRef<(LineBasicMaterial | null)[]>([]);
  const group = useRef<Group>(null);
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  const lastQ = useRef(Number.NaN);
  const drawnLines = useRef<LineSegments>(null);

  const foundation = useMemo(() => {
    const box = new BoxGeometry(lot.depth + 0.8, FOUNDATION_HEIGHT, lot.width + 0.8);
    box.translate(0, FOUNDATION_HEIGHT / 2, 0);
    const e = new EdgesGeometry(box);
    box.dispose();
    return e;
  }, [lot]);

  const segs = useMemo(() => credentialSegments(lot), [lot]);
  const drawn = useMemo(() => {
    const g = new BufferGeometry();
    const attr = new BufferAttribute(new Float32Array(segs.length * 6), 3);
    attr.setUsage(DynamicDrawUsage);
    g.setAttribute("position", attr);
    return g;
  }, [segs]);

  const ringGeo = useMemo(() => {
    const hx = lot.depth / 2 + 0.03;
    const hz = lot.width / 2 + 0.03;
    const pts: number[] = [];
    for (const y of [0.05, FLOOR_HEIGHT - 0.05]) {
      pts.push(-hx, y, -hz, hx, y, -hz, hx, y, -hz, hx, y, hz, hx, y, hz, -hx, y, hz, -hx, y, hz, -hx, y, -hz);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    return g;
  }, [lot]);

  useLayoutEffect(
    () => () => {
      foundation.dispose();
      drawn.dispose();
      ringGeo.dispose();
    },
    [foundation, drawn, ringGeo]
  );

  const anchors = useMemo(
    () =>
      Array.from(
        { length: CREDENTIAL_FLOOR_COUNT },
        (_, k) => new Vector3(lot.facadeX + o * 0.5, credentialFloorBase(k) + FLOOR_HEIGHT / 2, lot.width / 2)
      ),
    [lot, o]
  );
  const tmp = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const q = credentialsPhase(scrollStore.progress);

    // Grow each segment from its start point. Only rewrite when scroll moved.
    const geo = drawnLines.current?.geometry;
    if (geo && (Math.abs(q - lastQ.current) > 1e-5 || Number.isNaN(lastQ.current))) {
      lastQ.current = q;
      const arr = geo.attributes.position.array as Float32Array;
      segs.forEach((sg, i) => {
        const g = smoothstep(sg.t0, sg.t1, q);
        arr[i * 6] = sg.a.x;
        arr[i * 6 + 1] = sg.a.y;
        arr[i * 6 + 2] = sg.a.z;
        arr[i * 6 + 3] = sg.a.x + (sg.b.x - sg.a.x) * g;
        arr[i * 6 + 4] = sg.a.y + (sg.b.y - sg.a.y) * g;
        arr[i * 6 + 5] = sg.a.z + (sg.b.z - sg.a.z) * g;
      });
      geo.attributes.position.needsUpdate = true;
    }

    const labelOut = 1 - smoothstep(1.05, 1.3, q);
    for (let k = 0; k < CREDENTIAL_FLOOR_COUNT; k++) {
      const on = floorLight(q, k);
      const band = bands.current[k];
      if (band) band.opacity = on * 0.2;
      const ring = rings.current[k];
      if (ring) ring.opacity = on;
      const label = credentialLabelEls[k];
      if (label && group.current) {
        tmp.copy(anchors[k]);
        group.current.localToWorld(tmp).project(camera);
        const vis = tmp.z < 1 ? on * labelOut : 0;
        label.style.opacity = vis.toFixed(3);
        label.style.visibility = vis < 0.01 ? "hidden" : "visible";
        if (vis >= 0.01) {
          const x = (tmp.x * 0.5 + 0.5) * size.width;
          const y = (-tmp.y * 0.5 + 0.5) * size.height;
          label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateY(-50%)`;
        }
      }
    }
  });

  return (
    <group ref={group} position={lot.position} rotation-y={lot.yaw}>
      <lineSegments geometry={foundation}>
        <lineBasicMaterial color={palette.green} fog />
      </lineSegments>
      <lineSegments ref={drawnLines} geometry={drawn} frustumCulled={false}>
        <lineBasicMaterial color={palette.green} fog />
      </lineSegments>
      {Array.from({ length: CREDENTIAL_FLOOR_COUNT }, (_, k) => {
        const y = credentialFloorBase(k);
        return (
          <group key={k}>
            <lineSegments geometry={ringGeo} position-y={y}>
              <lineBasicMaterial
                ref={(m) => {
                  rings.current[k] = m;
                }}
                color={palette.green}
                transparent
                opacity={0}
                fog
              />
            </lineSegments>
            <mesh position={[lot.facadeX + o * 0.06, y + FLOOR_HEIGHT / 2, 0]} rotation={facadeRotation(lot)}>
              <planeGeometry args={[lot.width * 0.94, FLOOR_HEIGHT * 0.7]} />
              <meshBasicMaterial
                ref={(m) => {
                  bands.current[k] = m;
                }}
                color={palette.green}
                transparent
                opacity={0}
                fog
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function ContentBuildings() {
  return (
    <>
      <AboutHouse />
      <CredentialsBuilding />
    </>
  );
}
