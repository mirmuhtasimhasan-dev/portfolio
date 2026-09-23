"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  EdgesGeometry,
  Vector3,
  type Group,
  type LineBasicMaterial,
  type MeshBasicMaterial,
} from "three";
import {
  ABOUT_LOT,
  CREDENTIAL_FLOORS,
  CREDENTIALS_LOT,
  FLOOR_HEIGHT,
  type ContentLot,
} from "@/lib/contentBuildings";
import { credentialLabelEls } from "@/lib/labelStore";
import { palette } from "@/lib/palette";
import { scrollStore } from "@/lib/scrollStore";
import { sectionIndex } from "@/lib/sections";
import { sectionPhase } from "@/lib/stopMap";

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Box outline, floor rings and a grid of window outlines on the road-facing facade. */
function useShellGeometry(lot: ContentLot) {
  return useMemo(() => {
    const h = lot.floors * FLOOR_HEIGHT;
    const box = new BoxGeometry(lot.depth, h, lot.width);
    box.translate(0, h / 2, 0);
    const edges = new EdgesGeometry(box);
    box.dispose();

    const detail: number[] = [];
    const hx = lot.depth / 2;
    const hz = lot.width / 2;
    for (let f = 1; f < lot.floors; f++) {
      const y = f * FLOOR_HEIGHT;
      detail.push(-hx, y, -hz, hx, y, -hz, hx, y, -hz, hx, y, hz, hx, y, hz, -hx, y, hz, -hx, y, hz, -hx, y, -hz);
    }
    // Window outlines on the facade, 3 per floor.
    const fx = lot.facadeX + Math.sign(lot.facadeX) * 0.02;
    const cols = 3;
    for (let f = 0; f < lot.floors; f++) {
      for (let c = 0; c < cols; c++) {
        const zc = -hz + (lot.width / cols) * (c + 0.5);
        const y0 = f * FLOOR_HEIGHT + 0.9;
        const y1 = y0 + 1.5;
        const z0 = zc - 0.9;
        const z1 = zc + 0.9;
        detail.push(fx, y0, z0, fx, y0, z1, fx, y0, z1, fx, y1, z1, fx, y1, z1, fx, y1, z0, fx, y1, z0, fx, y0, z0);
      }
    }
    const detailGeo = new BufferGeometry();
    detailGeo.setAttribute("position", new BufferAttribute(new Float32Array(detail), 3));
    return { edges, detailGeo };
  }, [lot]);
}

function Shell({ lot }: { lot: ContentLot }) {
  const { edges, detailGeo } = useShellGeometry(lot);
  useLayoutEffect(
    () => () => {
      edges.dispose();
      detailGeo.dispose();
    },
    [edges, detailGeo]
  );
  return (
    <>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={palette.green} fog />
      </lineSegments>
      <lineSegments geometry={detailGeo}>
        <lineBasicMaterial color={palette.lineBase} fog />
      </lineSegments>
    </>
  );
}

/** Facade plane rotation so a PlaneGeometry (facing +Z) faces the road. */
const facadeRotation = (lot: ContentLot): [number, number, number] => [
  0,
  lot.facadeX > 0 ? Math.PI / 2 : -Math.PI / 2,
  0,
];

const ABOUT_INDEX = sectionIndex("about");
const CREDENTIALS_INDEX = sectionIndex("credentials");

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

function AboutBuilding() {
  const lot = ABOUT_LOT;
  const glow = useGlowTexture();
  const glass = useRef<MeshBasicMaterial>(null);
  const halo = useRef<MeshBasicMaterial>(null);
  const out = Math.sign(lot.facadeX);
  // Second floor, the window column nearest the approaching camera.
  const y = 2 * FLOOR_HEIGHT + 0.9 + 0.75;
  const z = -lot.width / 2 + lot.width / 6;

  useFrame(() => {
    // Fades on as the camera arrives; scrolling back up turns it off again.
    const on = smoothstep(-0.45, -0.05, sectionPhase(scrollStore.progress, ABOUT_INDEX));
    if (glass.current) glass.current.opacity = on;
    if (halo.current) halo.current.opacity = on * 0.35;
  });

  return (
    <group position={lot.position} rotation-y={lot.yaw}>
      <Shell lot={lot} />
      <group position={[lot.facadeX + out * 0.04, y, z]} rotation={facadeRotation(lot)}>
        <mesh>
          <planeGeometry args={[1.8, 1.5]} />
          <meshBasicMaterial ref={glass} color={palette.window} transparent opacity={0} fog depthWrite={false} />
        </mesh>
        <mesh position-z={0.02}>
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
    </group>
  );
}

// Floors light one by one as the camera arrives (phase -1..0 travel, 0..1 hold).
const FLOOR_ON_AT = [-0.2, 0.1, 0.4];
const FLOOR_FADE = 0.14;

function CredentialsBuilding() {
  const lot = CREDENTIALS_LOT;
  const out = Math.sign(lot.facadeX);
  const bands = useRef<(MeshBasicMaterial | null)[]>([]);
  const rings = useRef<(LineBasicMaterial | null)[]>([]);
  const group = useRef<Group>(null);
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  // Label anchors: just outside the far end of each lit floor, toward the road.
  const anchors = useMemo(
    () =>
      CREDENTIAL_FLOORS.map(
        (floor) => new Vector3(lot.facadeX + out * 0.5, floor * FLOOR_HEIGHT + FLOOR_HEIGHT / 2, lot.width / 2)
      ),
    [lot, out]
  );
  const tmp = useMemo(() => new Vector3(), []);

  const ringGeo = useMemo(() => {
    const hx = lot.depth / 2 + 0.03;
    const hz = lot.width / 2 + 0.03;
    const g = new BufferGeometry();
    // Top and bottom outline of one floor band.
    const pts: number[] = [];
    for (const y of [0.05, FLOOR_HEIGHT - 0.05]) {
      pts.push(-hx, y, -hz, hx, y, -hz, hx, y, -hz, hx, y, hz, hx, y, hz, -hx, y, hz, -hx, y, hz, -hx, y, -hz);
    }
    g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    return g;
  }, [lot]);
  useLayoutEffect(() => () => ringGeo.dispose(), [ringGeo]);

  useFrame(() => {
    const phase = sectionPhase(scrollStore.progress, CREDENTIALS_INDEX);
    // Labels leave with the section text; lit floors stay lit behind the camera.
    const labelOut = 1 - smoothstep(1.05, 1.3, phase);
    CREDENTIAL_FLOORS.forEach((_, i) => {
      const on = smoothstep(FLOOR_ON_AT[i], FLOOR_ON_AT[i] + FLOOR_FADE, phase);
      const band = bands.current[i];
      if (band) band.opacity = on * 0.2;
      const ring = rings.current[i];
      if (ring) ring.opacity = on;
      const label = credentialLabelEls[i];
      if (label && group.current) {
        tmp.copy(anchors[i]);
        group.current.localToWorld(tmp).project(camera);
        const inFront = tmp.z < 1;
        const o = inFront ? on * labelOut : 0;
        label.style.opacity = o.toFixed(3);
        label.style.visibility = o < 0.01 ? "hidden" : "visible";
        if (o >= 0.01) {
          const x = (tmp.x * 0.5 + 0.5) * size.width;
          const y = (-tmp.y * 0.5 + 0.5) * size.height;
          label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateY(-50%)`;
        }
      }
    });
  });

  return (
    <group ref={group} position={lot.position} rotation-y={lot.yaw}>
      <Shell lot={lot} />
      {CREDENTIAL_FLOORS.map((floor, i) => {
        const y = floor * FLOOR_HEIGHT;
        return (
          <group key={floor}>
            <lineSegments geometry={ringGeo} position-y={y}>
              <lineBasicMaterial
                ref={(m) => {
                  rings.current[i] = m;
                }}
                color={palette.green}
                transparent
                opacity={0}
                fog
              />
            </lineSegments>
            <mesh
              position={[lot.facadeX + out * 0.06, y + FLOOR_HEIGHT / 2, 0]}
              rotation={facadeRotation(lot)}
            >
              <planeGeometry args={[lot.width * 0.94, FLOOR_HEIGHT * 0.7]} />
              <meshBasicMaterial
                ref={(m) => {
                  bands.current[i] = m;
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
      <AboutBuilding />
      <CredentialsBuilding />
    </>
  );
}
