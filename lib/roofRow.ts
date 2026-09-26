import { Vector3 } from "three";
import { roadFrame } from "./road";

/*
 * Server roof: the hold stands past the end of the Backend gali (so the gali
 * signs are behind the camera) and looks up at one straight row of rooftop
 * signs on the left, laid out square to the line of sight: side by side,
 * same size and height, no stair-step into the distance.
 */
export const ROOF_CAM_A = 0.596;
export const ROOF_ROW = {
  /** Row center: along the road, metres left of the road center, height. */
  a: 0.628,
  lateral: -27,
  y: 17.2,
  w: 6,
  h: 1.95,
  gap: 0.7,
};

export const roofCamera = () => roadFrame(ROOF_CAM_A, 0, 3.4);
export const roofRowCenter = () => roadFrame(ROOF_ROW.a, ROOF_ROW.lateral, ROOF_ROW.y);

/** Centers and the shared yaw of the four (or n) boards in the row. */
export function roofRowSlots(n: number) {
  const cam = roofCamera();
  const c = roofRowCenter();
  // Line of sight (horizontal) and the direction square to it.
  const los = new Vector3(c.x - cam.x, 0, c.z - cam.z).normalize();
  const across = new Vector3(-los.z, 0, los.x);
  const yaw = Math.atan2(-los.x, -los.z);
  const step = ROOF_ROW.w + ROOF_ROW.gap;
  return Array.from({ length: n }, (_, k) => ({
    position: c.clone().addScaledVector(across, (k - (n - 1) / 2) * step),
    yaw,
  }));
}
