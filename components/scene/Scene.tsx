"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { palette } from "@/lib/palette";
import { City } from "./City";
import { Road } from "./Road";
import { CameraRig } from "./CameraRig";
import { ContentBuildings } from "./ContentBuildings";
import { CityWindows } from "./CityWindows";
import { RedHints } from "./RedHints";
import { NeonBazaar } from "./NeonBazaar";
import { FOG_DENSITY } from "./fog";

type Props = {
  onCut?: (apply: () => void) => void;
};

export default function Scene({ onCut }: Props) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

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
        frameloop={active ? "always" : "never"}
        flat
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 55, near: 2, far: 1400, position: [0, 80, 108] }}
      >
        <color attach="background" args={[palette.bgNight]} />
        <fogExp2 attach="fog" args={[palette.bgNight, FOG_DENSITY]} />
        <City />
        <Road />
        <ContentBuildings />
        <CityWindows />
        <RedHints />
        {/* Sign text loads its font; the rest of the scene never waits for it. */}
        <Suspense fallback={null}>
          <NeonBazaar />
        </Suspense>
        <CameraRig onCut={onCut} />
      </Canvas>
    </div>
  );
}
