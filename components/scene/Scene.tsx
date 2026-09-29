"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Selection, SelectiveBloom } from "@react-three/postprocessing";
import { getQuality } from "@/lib/quality";
import { Rain } from "./Rain";
import { RoadSheen } from "./WetRoad";
import { palette } from "@/lib/palette";
import { City } from "./City";
import { Road } from "./Road";
import { CameraRig } from "./CameraRig";
import { ContentBuildings } from "./ContentBuildings";
import { CityWindows } from "./CityWindows";
import { RedHints } from "./RedHints";
import { NeonBazaar } from "./NeonBazaar";
import { Hatirjheel } from "./Hatirjheel";
import { Landmarks } from "./Landmarks";
import { TechGate } from "./TechGate";
import { CursorProbe } from "./CursorProbe";
import { FrameDriver } from "./FrameDriver";
import { Ambient } from "./Ambient";
import { FOG_DENSITY } from "./fog";

type Props = {
  onCut?: (apply: () => void) => void;
};

export default function Scene({ onCut }: Props) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  // Client only (the canvas is loaded with ssr: false), so this is safe here.
  const [quality] = useState(getQuality);

  // Pause rendering when the tab is hidden or the canvas is off screen.
  useEffect(() => {
    let visible = !document.hidden;
    let onScreen = true;
    const update = () => setActive(visible && onScreen);
    const onVis = () => {
      visible = !document.hidden;
      update();
    };
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    if (wrapper.current) io.observe(wrapper.current);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
    };
  }, []);

  // near = 2: geometry closer than 2 m to the camera is never drawn.
  return (
    <div ref={wrapper} className="absolute inset-0">
      <Canvas
        // FrameDriver runs the loop: full rate while active, ~30 fps when idle.
        frameloop="never"
        flat
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 55, near: 2, far: 1400, position: [0, 80, 108] }}
      >
        <Selection>
        {/* Background is the shared SKY colour (set by Landmarks' SkyShift). */}
        <fogExp2 attach="fog" args={[palette.bgNight, FOG_DENSITY]} />
        <City />
        <Road />
        <RoadSheen />
        <Rain count={quality.rain} />
        <ContentBuildings />
        <CityWindows />
        <RedHints />
        {/* Sign text loads its font; the rest of the scene never waits for it. */}
        <Suspense fallback={null}>
          <NeonBazaar />
        </Suspense>
        <Suspense fallback={null}>
          <TechGate />
        </Suspense>
        {/* Small, slow, dim details per section: desktop only, never with reduced motion. */}
        {!quality.phone && !quality.reduced && <Ambient />}
        <Hatirjheel />
        <Landmarks />
        <CameraRig onCut={onCut} />
        <CursorProbe />
        <FrameDriver active={active} />
        {quality.bloom && (
          // Only bright things cross the threshold: neon, lamps, lit windows,
          // screenshots. Line-base building edges stay dim and unbloomed.
          // Inverted selective bloom: everything blooms as before except the
          // objects wrapped in <Select> (sign logos and names), which get a
          // thin hand-drawn halo instead.
          <EffectComposer multisampling={4}>
            <SelectiveBloom
              inverted
              mipmapBlur
              luminanceThreshold={0.34}
              luminanceSmoothing={0.18}
              intensity={0.85}
              radius={0.62}
            />
          </EffectComposer>
        )}
        </Selection>
      </Canvas>
    </div>
  );
}
