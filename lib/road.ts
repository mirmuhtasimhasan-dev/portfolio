import { CatmullRomCurve3, Vector3 } from "three";

/*
 * World layout: the road starts under the hero sky view and runs toward -Z,
 * bending right for the Hatirjheel stretch and ending at the lake in front of
 * Sangsad Bhaban. Everything (city, camera, bridge) is placed relative to it.
 */
export const ROAD_HALF_WIDTH = 5;

export const roadCurve = new CatmullRomCurve3(
  [
    new Vector3(0, 0, 90),
    new Vector3(0, 0, 20),
    new Vector3(5, 0, -60),
    new Vector3(-6, 0, -140),
    new Vector3(2, 0, -215),
    new Vector3(24, 0, -280),
    new Vector3(62, 0, -335),
    new Vector3(76, 0, -405),
    new Vector3(62, 0, -470),
    new Vector3(56, 0, -505),
  ],
  false,
  "centripetal"
);

export const ROAD_LENGTH = roadCurve.getLength();
const UP = new Vector3(0, 1, 0);

/** Point beside the road: a = arc fraction 0..1, lateral = metres to the right, height = metres up. */
export function roadFrame(a: number, lateral = 0, height = 0): Vector3 {
  const p = roadCurve.getPointAt(a);
  const tangent = roadCurve.getTangentAt(a);
  const right = new Vector3().crossVectors(tangent, UP).normalize();
  return p.addScaledVector(right, lateral).setY(height);
}

/** The lake + Sangsad Bhaban site past the road end (kept clear of buildings). */
const roadEnd = roadCurve.getPointAt(1);
const roadEndDir = roadCurve.getTangentAt(1);
export const LAKE_CENTER = roadEnd.clone().addScaledVector(roadEndDir, 70);
export const LAKE_RADIUS = 70;
export const SANGSAD_POSITION = roadEnd.clone().addScaledVector(roadEndDir, 160);
