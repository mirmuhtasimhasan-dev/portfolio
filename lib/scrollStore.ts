// Mutable, non-React store. Written by the scroll system and the render loop,
// read every frame by the camera rig, overlays and debug panel.
export const scrollStore = {
  /** Master scroll progress 0..1 (Lenis-smoothed). */
  progress: 0,
  /** Stop-space value after the stop map (0..SECTION_COUNT-1). */
  stop: 0,
  /** Nearest section index. */
  section: 0,
  /** Render frames per second, measured in the R3F loop. */
  fps: 0,
  reducedMotion: false,
};
