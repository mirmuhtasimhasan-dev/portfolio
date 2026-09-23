"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { palette } from "@/lib/palette";
import { City } from "./City";
import { Road } from "./Road";
import { CameraRig } from "./CameraRig";

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

  return (
    <div ref={wrapper} className="absolute inset-0">
      <Canvas
        frameloop={active ? "always" : "never"}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 55, near: 0.5, far: 1400, position: [0, 150, 150] }}
      >
        <color attach="background" args={[palette.bgNight]} />
        <fog attach="fog" args={[palette.bgNight, 90, 620]} />
        <City />
        <Road />
        <CameraRig onCut={onCut} />
      </Canvas>
    </div>
  );
}
