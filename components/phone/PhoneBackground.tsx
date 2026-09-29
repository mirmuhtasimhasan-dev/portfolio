"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Color } from "three";
import { palette } from "@/lib/palette";
import { mulberry32 } from "@/lib/random";

/*
 * Phone background (SPEC.md section 8): one fixed, dim wireframe Dhaka skyline
 * low on the screen. It drifts a little with scroll (the layers sit at
 * different depths, so they part gently) and a few windows flicker. Rendered
 * on demand only: a frame per scroll step or flicker, pixel ratio 1, no bloom,
 * nothing when the tab is hidden. Reduced motion: still, windows steady.
 */

const LAYERS = [
  { z: -70, min: 8, max: 26, tint: 0.1 },
  { z: -120, min: 14, max: 40, tint: 0.05 },
  { z: -180, min: 22, max: 60, tint: 0 },
];
const WINDOW_COUNT = 46;

function buildSkyline() {
  const rnd = mulberry32(1971);
  const pos: number[] = [];
  const col: number[] = [];
  const windows: number[] = [];
  const base = new Color(palette.lineBase);
  const green = new Color(palette.green);
  const c = new Color();
  const fronts: { x: number; w: number; h: number; z: number }[] = [];
  for (const L of LAYERS) {
    c.copy(base).lerp(green, L.tint);
    let x = -230 + rnd() * 10;
    while (x < 230) {
      const w = 7 + rnd() * 12;
      const d = 6 + rnd() * 8;
      const h = L.min + rnd() * (L.max - L.min);
      const z = L.z + (rnd() - 0.5) * 16;
      const x0 = x;
      const x1 = x + w;
      const z0 = z;
      const z1 = z - d;
      const edge = (a: number[], b: number[]) => {
        pos.push(...a, ...b);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      };
      // Box edges (no bottom), plus the odd floor line on the front face.
      for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) edge([px, 0, pz], [px, h, pz]);
      edge([x0, h, z0], [x1, h, z0]);
      edge([x1, h, z0], [x1, h, z1]);
      edge([x1, h, z1], [x0, h, z1]);
      edge([x0, h, z1], [x0, h, z0]);
      if (rnd() < 0.4) {
        const rw = w * (0.3 + rnd() * 0.3);
        const rx = x0 + rnd() * (w - rw);
        edge([rx, h, z0 - 1], [rx, h + 3, z0 - 1]);
        edge([rx + rw, h, z0 - 1], [rx + rw, h + 3, z0 - 1]);
        edge([rx, h + 3, z0 - 1], [rx + rw, h + 3, z0 - 1]);
      }
      if (L.tint > 0) fronts.push({ x: x0, w, h, z: z0 });
      x += w + 1 + rnd() * 4;
    }
  }
  for (let i = 0; i < WINDOW_COUNT; i++) {
    const f = fronts[Math.floor(rnd() * fronts.length)];
    const floor = 1 + Math.floor(rnd() * Math.max(1, f.h / 3.2 - 1));
    windows.push(f.x + 1 + rnd() * (f.w - 2), floor * 3.2 + 1.4, f.z + 0.1);
  }
  const lines = new BufferGeometry();
  lines.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  lines.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  const lights = new BufferGeometry();
  lights.setAttribute("position", new BufferAttribute(new Float32Array(windows), 3));
  lights.setAttribute("color", new BufferAttribute(new Float32Array(WINDOW_COUNT * 3), 3));
  return { lines, lights };
}

const WARM = new Color(palette.window).multiplyScalar(0.55);
/** Eye just above the rooftops, tilted up, so the skyline sits in the bottom third. */
const EYE = { x: 0, y: 34, z: 40 };
const LOOK = { y: 72, z: -150 };

function Skyline({ reduced }: { reduced: boolean }) {
  const { lines, lights } = useMemo(() => buildSkyline(), []);
  useLayoutEffect(
    () => () => {
      lines.dispose();
      lights.dispose();
    },
    [lines, lights]
  );
  const invalidate = useThree((s) => s.invalidate);

  // Windows: most on, a few off; every so often one flickers or switches.
  useEffect(() => {
    const colors = lights.getAttribute("color") as BufferAttribute;
    const rnd = mulberry32(7);
    const set = (i: number, on: boolean) => {
      const k = on ? 1 : 0;
      colors.setXYZ(i, WARM.r * k, WARM.g * k, WARM.b * k);
    };
    for (let i = 0; i < WINDOW_COUNT; i++) set(i, rnd() < 0.7);
    colors.needsUpdate = true;
    invalidate();
    if (reduced) return;
    let t = 0;
    const step = () => {
      if (!document.hidden) {
        const i = Math.floor(Math.random() * WINDOW_COUNT);
        const on = colors.getX(i) > 0;
        set(i, !on);
        colors.needsUpdate = true;
        invalidate();
        // Half the time it is only a flicker: back as it was a moment later.
        if (Math.random() < 0.5) {
          window.setTimeout(() => {
            set(i, on);
            colors.needsUpdate = true;
            invalidate();
          }, 90 + Math.random() * 120);
        }
      }
      t = window.setTimeout(step, 500 + Math.random() * 900);
    };
    t = window.setTimeout(step, 800);
    return () => window.clearTimeout(t);
  }, [lights, reduced, invalidate]);

  // A frame per scroll step (rAF-throttled); nothing while the page is still.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), invalidate()));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced, invalidate]);

  useFrame(({ camera }) => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const p = reduced ? 0 : Math.min(1, window.scrollY / max);
    camera.position.set(EYE.x - 10 + 20 * p, EYE.y + 8 * p, EYE.z);
    camera.lookAt(EYE.x - 10 + 20 * p, LOOK.y + 8 * p, LOOK.z);
  });

  return (
    <>
      <lineSegments geometry={lines}>
        <lineBasicMaterial vertexColors fog />
      </lineSegments>
      <points geometry={lights}>
        <pointsMaterial vertexColors size={1.1} fog />
      </points>
    </>
  );
}

export default function PhoneBackground({ reduced }: { reduced: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        frameloop="demand"
        dpr={1}
        flat
        gl={{ antialias: true, powerPreference: "low-power" }}
        camera={{ fov: 50, near: 1, far: 600, position: [EYE.x, EYE.y, EYE.z] }}
      >
        <color attach="background" args={[palette.bgNight]} />
        <fogExp2 attach="fog" args={[palette.bgNight, 0.0045]} />
        <Skyline reduced={reduced} />
      </Canvas>
    </div>
  );
}
