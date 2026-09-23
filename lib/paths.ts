import { CatmullRomCurve3, Vector3 } from "three";
import { SECTION_COUNT } from "./sections";

/*
 * World layout: the road starts under the hero sky view and runs toward -Z,
 * bending right for the Hatirjheel stretch and ending at the lake in front of
 * Sangsad Bhaban. Everything (city, camera) is placed relative to this curve.
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

/*
 * Camera keyframes. `stop` marks the keyframe that is a section's camera stop;
 * others are in-between waypoints that shape travel. Position and look target
 * each get their own centripetal CatmullRom curve through these points.
 */
type Key = { pos: Vector3; look: Vector3; stop?: number };

const KEYS: Key[] = [
  // 0 Hero: high over the city, looking across the skyline.
  { stop: 0, pos: new Vector3(-10, 150, 150), look: new Vector3(20, 20, -260) },
  // Dive toward the street.
  { pos: new Vector3(-4, 70, 60), look: roadFrame(0.22, 0, 6) },
  { pos: roadFrame(0.1, 0, 22), look: roadFrame(0.22, 6, 6) },
  // 1 About: street level, residential building on the right.
  { stop: 1, pos: roadFrame(0.18, -2.5, 3.2), look: roadFrame(0.205, 15, 8) },
  { pos: roadFrame(0.245, 0, 3.6), look: roadFrame(0.31, -4, 6) },
  // 2 Credentials: the next building, on the left.
  { stop: 2, pos: roadFrame(0.29, 2.5, 3.6), look: roadFrame(0.315, -15, 12) },
  { pos: roadFrame(0.36, 0, 3.4), look: roadFrame(0.46, 0, 4) },
  // 3 Toolset: looking down the bazaar street.
  { stop: 3, pos: roadFrame(0.42, 0, 3.2), look: roadFrame(0.5, 0, 5) },
  { pos: roadFrame(0.53, 0, 4.5), look: roadFrame(0.64, 0, 5) },
  // 4 Projects: onto the Hatirjheel stretch.
  { stop: 4, pos: roadFrame(0.62, 0, 6), look: roadFrame(0.72, 0, 6) },
  { pos: roadFrame(0.8, 0, 6), look: roadFrame(0.93, 0, 8) },
  // 5 Contact: road end, looking across the lake at Sangsad Bhaban.
  {
    stop: 5,
    pos: roadFrame(0.965, 0, 6),
    look: SANGSAD_POSITION.clone().setY(22),
  },
];

export const cameraPositionCurve = new CatmullRomCurve3(
  KEYS.map((k) => k.pos),
  false,
  "centripetal"
);
export const cameraLookCurve = new CatmullRomCurve3(
  KEYS.map((k) => k.look),
  false,
  "centripetal"
);

/**
 * Arc-length fraction (u for getPointAt) of each stop keyframe on a curve.
 * CatmullRomCurve3.getPoint(t) hits keyframe k at t = k / (n - 1); we convert
 * that to arc length so travel speed is even along the whole path.
 */
function stopArcFractions(curve: CatmullRomCurve3): number[] {
  const n = curve.points.length;
  const samples = 2000;
  const cum: number[] = [0];
  let prev = curve.getPoint(0);
  for (let i = 1; i <= samples; i++) {
    const p = curve.getPoint(i / samples);
    cum.push(cum[i - 1] + p.distanceTo(prev));
    prev = p;
  }
  const total = cum[samples];
  const out: number[] = [];
  KEYS.forEach((k, idx) => {
    if (k.stop === undefined) return;
    const t = idx / (n - 1);
    out[k.stop] = cum[Math.round(t * samples)] / total;
  });
  return out;
}

const posStops = stopArcFractions(cameraPositionCurve);
const lookStops = stopArcFractions(cameraLookCurve);

if (posStops.length !== SECTION_COUNT) {
  throw new Error("Every section needs exactly one camera stop keyframe.");
}

/** Sample both curves at stop-space value s (0..SECTION_COUNT-1). */
export function sampleCamera(s: number, outPos: Vector3, outLook: Vector3) {
  const i = Math.min(Math.floor(s), SECTION_COUNT - 2);
  const f = Math.min(1, Math.max(0, s - i));
  const uPos = posStops[i] + (posStops[i + 1] - posStops[i]) * f;
  const uLook = lookStops[i] + (lookStops[i + 1] - lookStops[i]) * f;
  cameraPositionCurve.getPointAt(Math.min(1, Math.max(0, uPos)), outPos);
  cameraLookCurve.getPointAt(Math.min(1, Math.max(0, uLook)), outLook);
}
