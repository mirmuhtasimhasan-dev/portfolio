"use client";

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
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
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ABOUT_COLS,
  ABOUT_LOT,
  ABOUT_WINDOW,
  BALCONY_DEPTH,
  CREDENTIAL_FLOOR_COUNT,
  CREDENTIAL_LIP,
  SITE_BOARD,
  CREDENTIALS_LOT,
  FLOOR_HEIGHT,
  FOUNDATION_HEIGHT,
  aboutWindowLocal,
  credentialFloorBase,
  type ContentLot,
} from "@/lib/contentBuildings";
import { getDhakaHouse } from "@/lib/dhakaHouse";
import { aboutCardEls } from "@/lib/labelStore";
import { CREDENTIALS, PERSON } from "@/lib/content";
import { ROAD_LENGTH, roadFrame, sampleCamera } from "@/lib/paths";
import { sectionIndex } from "@/lib/sections";
import { Line, Text } from "@react-three/drei";
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
  buildStatus,
  cityLit,
  credentialsPhase,
  floorLight,
  smoothstep,
} from "@/lib/timeline";

const FONT = "/fonts/geist-mono-600.woff";
const rectPoints = (w: number, h: number): [number, number, number][] => [
  [-w / 2, -h / 2, 0.01], [w / 2, -h / 2, 0.01],
  [w / 2, -h / 2, 0.01], [w / 2, h / 2, 0.01],
  [w / 2, h / 2, 0.01], [-w / 2, h / 2, 0.01],
  [-w / 2, h / 2, 0.01], [-w / 2, -h / 2, 0.01],
];

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
  const lipX = fx + o * CREDENTIAL_LIP;
  const lipZ0 = BANNER.z - BANNER.w / 2 - 0.4;
  const lipZ1 = BANNER.z + BANNER.w / 2 + 0.4;

  for (let k = 0; k < CREDENTIAL_FLOOR_COUNT; k++) {
    const y0 = credentialFloorBase(k);
    const y1 = y0 + FLOOR_HEIGHT;
    const floor: [Vector3, Vector3][] = [];
    // Corner posts grow upward, then the slab edges, then the windows,
    // then the balcony edge the banner hangs from.
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
    floor.push([new Vector3(fx, y1, lipZ0), new Vector3(lipX, y1, lipZ0)]);
    floor.push([new Vector3(fx, y1, lipZ1), new Vector3(lipX, y1, lipZ1)]);
    floor.push([new Vector3(lipX, y1, lipZ0), new Vector3(lipX, y1, lipZ1)]);
    const n = floor.length;
    floor.forEach(([a, b], i) => {
      const t0 = starts[k] + draw * (i / n) * 0.75;
      segs.push({ a, b, t0, t1: t0 + draw * 0.25 });
    });
  }
  return segs;
}

/** Banner hanging from each floor's balcony edge (lot-local units, metres). */
// Offset toward the building's near end, so the signboard beside the far end stays clear.
const BANNER = { w: 11, h: 1.55, drop: 0.12, z: -1.2 };

type TroikaText = Mesh & { fillOpacity: number; text: string; color: Color | string; sync: () => void };

/** A credential banner that unrolls down from the balcony edge as its floor lights. */
function CredentialBanner({ k, lot }: { k: number; lot: ContentLot }) {
  const o = Math.sign(lot.facadeX);
  const roll = useRef<Group>(null);
  const cloth = useRef<MeshBasicMaterial>(null);
  const border = useRef<LineBasicMaterial>(null);
  const year = useRef<TroikaText>(null);
  const title = useRef<TroikaText>(null);
  const item = CREDENTIALS[k];
  const top = credentialFloorBase(k) + FLOOR_HEIGHT - BANNER.drop;

  const outline = useMemo(() => {
    const w = BANNER.w / 2;
    const h = BANNER.h;
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([-w, 0, 0.01, w, 0, 0.01, w, 0, 0.01, w, -h, 0.01, w, -h, 0.01, -w, -h, 0.01, -w, -h, 0.01, -w, 0, 0.01]),
        3
      )
    );
    return g;
  }, []);
  useLayoutEffect(() => () => outline.dispose(), [outline]);

  useFrame(() => {
    const on = floorLight(credentialsPhase(scrollStore.progress), k);
    if (roll.current) {
      roll.current.visible = on > 0.001;
      roll.current.scale.y = Math.max(0.001, on);
    }
    if (cloth.current) cloth.current.opacity = 0.94 * on;
    if (border.current) border.current.opacity = on;
    if (year.current) year.current.fillOpacity = on;
    if (title.current) title.current.fillOpacity = on;
  });

  return (
    <group position={[lot.facadeX + o * CREDENTIAL_LIP, top, BANNER.z]} rotation={facadeRotation(lot)}>
      {/* Two short cords from the balcony edge, then the cloth unrolling down. */}
      <group ref={roll} visible={false}>
        <mesh position-y={-BANNER.h / 2}>
          <planeGeometry args={[BANNER.w, BANNER.h]} />
          <meshBasicMaterial ref={cloth} color={palette.bgNight} transparent opacity={0} fog depthWrite={false} />
        </mesh>
        <lineSegments geometry={outline}>
          <lineBasicMaterial ref={border} color={palette.green} transparent opacity={0} fog />
        </lineSegments>
        <Text
          ref={year}
          font={FONT}
          fontSize={0.3}
          color={palette.green}
          anchorX="left"
          anchorY="top"
          position={[-BANNER.w / 2 + 0.35, -0.22, 0.02]}
          letterSpacing={0.12}
          fillOpacity={0}
        >
          {String(item.year)}
        </Text>
        <Text
          ref={title}
          font={FONT}
          fontSize={0.42}
          color={palette.text}
          anchorX="left"
          anchorY="top"
          maxWidth={BANNER.w - 0.7}
          position={[-BANNER.w / 2 + 0.35, -0.64, 0.02]}
          fillOpacity={0}
        >
          {item.issuer ? `${item.title} · ${item.issuer}` : item.title}
        </Text>
      </group>
    </group>
  );
}

/** Dhaka-style construction signboard on legs, facing the Credentials camera. */
function SiteBoard() {
  const lot = CREDENTIALS_LOT;
  const status = useRef<TroikaText>(null);
  const shown = useRef("");
  const { w, h, bottom } = SITE_BOARD;

  const { position, yaw, legs } = useMemo(() => {
    const a = lot.a + (lot.width / 2 - SITE_BOARD.alongFromEnd) / ROAD_LENGTH;
    const pos = roadFrame(a, lot.side * SITE_BOARD.lateral, bottom + h / 2);
    const cam = new Vector3();
    const look = new Vector3();
    sampleCamera(sectionIndex("credentials"), cam, look);
    const y = Math.atan2(cam.x - pos.x, cam.z - pos.z);
    const c = Math.cos(y);
    const sn = Math.sin(y);
    const pts: number[] = [];
    for (const u of [-w * 0.38, w * 0.38]) {
      const x = pos.x + u * c;
      const z = pos.z - u * sn;
      pts.push(x, 0, z, x, bottom + h * 0.85, z);
    }
    // Cross brace between the legs, like a bamboo frame.
    pts.push(pos.x - w * 0.38 * c, 0.2, pos.z + w * 0.38 * sn, pos.x + w * 0.38 * c, bottom - 0.05, pos.z - w * 0.38 * sn);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    return { position: pos, yaw: y, legs: g };
  }, [lot, w, h, bottom]);
  useLayoutEffect(() => () => legs.dispose(), [legs]);

  useFrame(({ clock }) => {
    const t = status.current;
    if (!t) return;
    const st = buildStatus(credentialsPhase(scrollStore.progress));
    if (st.text !== shown.current) {
      shown.current = st.text;
      t.text = st.text;
      t.color = st.done ? palette.green : palette.text;
      t.sync();
    }
    t.fillOpacity = st.done ? 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(clock.elapsedTime * 2.2)) : 1;
  });

  const rows: [string, string][] = [
    ["PROJECT", "What I studied"],
    ["DEVELOPER", PERSON.shortName],
    ["STARTED", String(Math.min(...CREDENTIALS.map((c) => c.year)))],
  ];
  const rowY = (i: number) => h / 2 - 0.7 - i * 0.95;
  const labelX = -w / 2 + 0.45;
  const valueX = -w / 2 + 2.9;

  return (
    <group>
      <lineSegments geometry={legs}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
      {/* Drawn over the building's corner lines so they never cross the board's text. */}
      <group position={position} rotation-y={yaw}>
        <mesh renderOrder={20}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={palette.bgNight} fog depthTest={false} />
        </mesh>
        <Line points={rectPoints(w, h)} segments lineWidth={1.4} color={palette.green} depthTest={false} renderOrder={21} />
        {rows.map(([label, value], i) => (
          <group key={label}>
            <Text renderOrder={22} material-depthTest={false} font={FONT} fontSize={0.32} letterSpacing={0.08} color={palette.text2} anchorX="left" anchorY="middle" position={[labelX, rowY(i), 0.02]}>
              {label}
            </Text>
            <Text renderOrder={22} material-depthTest={false} font={FONT} fontSize={0.52} color={palette.text} anchorX="left" anchorY="middle" whiteSpace="nowrap" position={[valueX, rowY(i), 0.02]}>
              {value}
            </Text>
          </group>
        ))}
        <Line points={[[-w / 2 + 0.3, rowY(2) - 0.48, 0.02], [w / 2 - 0.3, rowY(2) - 0.48, 0.02]]} lineWidth={1} color={palette.lineBase} depthTest={false} renderOrder={21} />
        <Text renderOrder={22} material-depthTest={false} font={FONT} fontSize={0.32} letterSpacing={0.08} color={palette.text2} anchorX="left" anchorY="middle" position={[labelX, rowY(3), 0.02]}>
          STATUS
        </Text>
        <Text ref={status} renderOrder={22} material-depthTest={false} font={FONT} fontSize={0.52} color={palette.text} anchorX="left" anchorY="middle" whiteSpace="nowrap" position={[valueX, rowY(3), 0.02]}>
          Foundation
        </Text>
      </group>
    </group>
  );
}

function CredentialsBuilding() {
  const lot = CREDENTIALS_LOT;
  const o = Math.sign(lot.facadeX);
  const bands = useRef<(MeshBasicMaterial | null)[]>([]);
  const rings = useRef<(LineBasicMaterial | null)[]>([]);
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

    for (let k = 0; k < CREDENTIAL_FLOOR_COUNT; k++) {
      const on = floorLight(q, k);
      const band = bands.current[k];
      if (band) band.opacity = on * 0.12;
      const ring = rings.current[k];
      if (ring) ring.opacity = on;
    }
  });

  return (
    <>
      <group position={lot.position} rotation-y={lot.yaw}>
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
              {/* Text loads a font; never let it suspend the whole canvas. */}
              <Suspense fallback={null}>
                <CredentialBanner k={k} lot={lot} />
              </Suspense>
            </group>
          );
        })}
      </group>
      <Suspense fallback={null}>
        <SiteBoard />
      </Suspense>
    </>
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
