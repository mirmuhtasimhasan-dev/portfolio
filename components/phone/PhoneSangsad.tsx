"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { AdditiveBlending, Box3, CanvasTexture, Color, MeshBasicMaterial, type Mesh } from "three";
import { palette } from "@/lib/palette";
import { useCappedInvalidate } from "./useCappedInvalidate";
import { MODEL_URL, buildSangsadParts } from "@/lib/sangsadModel";

/*
 * Phone Contact view (docs/SPEC.md section 8): Sangsad Bhaban from the Blender
 * model, a still front view in green edges, and the red sun rising a little
 * behind it as the section scrolls up the screen. Renders only on demand and
 * only while on screen; reduced motion shows the sun already risen.
 */

const FOV = 34;
/** Lake level (y = 0 is the building's base) and the space kept around it. */
const BASE_Y = -3;
const MARGIN = 1.12;
const SUN = { r: 11, z: -130 };
const LAKE = new Color(palette.bgNight).lerp(new Color(palette.bgDawn), 0.5);
/** How far the sun has risen, 0..1 (written from scroll, read each frame). */
const sunRise = { value: 1 };

type Fit = { halfWidth: number; top: number };

/** The building's +X facade faces the camera; reports its size to fit the view. */
function Building({ onFit }: { onFit: (fit: Fit) => void }) {
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
  const fill = useMemo(
    () => new MeshBasicMaterial({ color: palette.bgNight, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    []
  );
  useLayoutEffect(() => () => fill.dispose(), [fill]);

  // Turned by -90 degrees, model z becomes screen x (x' = -z). The octagon
  // (model origin) stays at the centre; fit the wider side. Measured on the
  // solid faces (curved walls have no crease edges).
  const bounds = useMemo(() => {
    const b = new Box3();
    for (const g of parts.fills) {
      g.computeBoundingBox();
      b.union(g.boundingBox!);
    }
    return { halfWidth: Math.max(-b.min.z, b.max.z), top: b.max.y };
  }, [parts]);
  useLayoutEffect(() => onFit({ halfWidth: bounds.halfWidth, top: bounds.top }), [bounds, onFit]);

  return (
    <group rotation-y={-Math.PI / 2}>
      {parts.fills.map((g, i) => (
        <mesh key={i} geometry={g} material={fill} />
      ))}
      <lineSegments geometry={parts.edges}>
        <lineBasicMaterial color={palette.green} />
      </lineSegments>
      <lineSegments geometry={parts.bands}>
        <lineBasicMaterial color={palette.green} transparent opacity={0.3} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

function useHaloTexture() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(244,63,94,0.55)");
    grad.addColorStop(0.35, "rgba(244,63,94,0.18)");
    grad.addColorStop(1, "rgba(244,63,94,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  }, []);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function Stage() {
  const sun = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const haloTex = useHaloTexture();
  const size = useThree((s) => s.size);
  const invalidate = useCappedInvalidate();
  const [fit, setFit] = useState<Fit | null>(null);
  const onFit = useCallback(
    (f: Fit) => {
      setFit(f);
      invalidate();
    },
    [invalidate]
  );

  useFrame(({ camera }) => {
    // Fit the whole width of the building, and the height from the lake to
    // the top of the risen sun.
    const top = fit?.top ?? 47;
    const sunHigh = top + SUN.r + 9;
    const sunLow = top * 0.35;
    const aspect = size.width / size.height;
    const t = Math.tan(((FOV / 2) * Math.PI) / 180);
    const halfH = (sunHigh + SUN.r - BASE_Y) / 2;
    const midY = BASE_Y + halfH;
    const dist = Math.max(((fit?.halfWidth ?? 100) * MARGIN) / (t * aspect), (halfH * MARGIN) / t);
    camera.position.set(0, midY, dist);
    camera.lookAt(0, midY, 0);
    const y = sunLow + (sunHigh - sunLow) * sunRise.value;
    sun.current?.position.set(0, y, SUN.z);
    halo.current?.position.set(0, y, SUN.z - 1);
  });

  return (
    <>
      <mesh ref={halo}>
        <planeGeometry args={[SUN.r * 4.5, SUN.r * 4.5]} />
        <meshBasicMaterial map={haloTex} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh ref={sun}>
        <circleGeometry args={[SUN.r, 48]} />
        <meshBasicMaterial color={palette.red} />
      </mesh>
      {/* The lake's edge in front of the building. */}
      <mesh position={[0, -0.4, 60]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[600, 160]} />
        <meshBasicMaterial color={LAKE} />
      </mesh>
      <Suspense fallback={null}>
        <Building onFit={onFit} />
      </Suspense>
    </>
  );
}

/** Scroll-driven sun: re-render on scroll while the stage is on screen. */
function Driver({ box, reduced }: { box: React.RefObject<HTMLDivElement | null>; reduced: boolean }) {
  const invalidate = useCappedInvalidate();
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 as the stage comes up from the bottom, 1 once its top is near the top.
      const p = (vh - r.top) / (vh * 0.85);
      sunRise.value = reduced ? 1 : Math.min(1, Math.max(0, p));
      invalidate();
    };
    update();
    if (reduced) return;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), update()));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [box, reduced, invalidate]);
  return null;
}

export default function PhoneSangsad({ reduced }: { reduced: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Only render (and listen) while the stage is on screen.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={box}
      aria-hidden
      className="relative h-[clamp(220px,40svh,340px)] w-full [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_94%,transparent)]"
      style={{
        background:
          "radial-gradient(ellipse 70% 55% at 50% 62%, rgb(244 63 94 / 0.16), transparent 70%), linear-gradient(to bottom, #0a0f0c, #10281b)",
      }}
    >
      <Canvas
        frameloop={visible ? "demand" : "never"}
        dpr={1}
        flat
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        camera={{ fov: FOV, near: 5, far: 2000, position: [0, 30, 300] }}
      >
        <Stage />
        {visible && <Driver box={box} reduced={reduced} />}
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
