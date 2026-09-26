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

/** Street-level eye height. Street keys sit on the road center line (lateral 0). */
export const EYE = 3.4;

const KEYS: Key[] = [
  // 0 Hero: above the road start, horizon in the upper half, skyline filling the lower half.
  { stop: 0, pos: new Vector3(0, 80, 108), look: new Vector3(18, 34, -260) },
  // Dive down the road corridor.
  { pos: new Vector3(0, 46, 52), look: roadFrame(0.27, 0, 8) },
  { pos: roadFrame(0.1, 0, 15), look: roadFrame(0.26, 0, EYE + 1) },
  // 1 About: road center, residential building ahead on the right.
  { stop: 1, pos: roadFrame(0.18, 0, EYE), look: roadFrame(0.215, 12, EYE) },
  { pos: roadFrame(0.245, 0, EYE), look: roadFrame(0.33, 0, EYE) },
  // 2 Credentials: road center, the next building ahead on the left.
  // Framed so every floor banner and the signboard beside it are in view.
  { stop: 2, pos: roadFrame(0.29, 0, EYE), look: roadFrame(0.32, -14, EYE + 1) },
  { pos: roadFrame(0.36, 0, EYE), look: roadFrame(0.46, 0, EYE) },
  // 3 Toolset: looking down the bazaar street.
  // Look slightly up so the rooftop boards of the Server roof stay in frame.
  { stop: 3, pos: roadFrame(0.42, 0, EYE), look: roadFrame(0.5, 0, EYE + 3) },
  { pos: roadFrame(0.5, 0, EYE + 0.5), look: roadFrame(0.6, 0, EYE + 1) },
  { pos: roadFrame(0.565, 0, EYE + 1.5), look: roadFrame(0.66, 0, 5) },
  // 4 Projects: onto the Hatirjheel stretch.
  { stop: 4, pos: roadFrame(0.62, 0, 6), look: roadFrame(0.72, 0, 6) },
  // Follow the road through the bend instead of cutting the corner.
  { pos: roadFrame(0.66, 0, 6), look: roadFrame(0.76, 0, 6) },
  { pos: roadFrame(0.7, 0, 6), look: roadFrame(0.8, 0, 6) },
  { pos: roadFrame(0.78, 0, 6), look: roadFrame(0.88, 0, 6) },
  { pos: roadFrame(0.825, 0, 6), look: roadFrame(0.925, 0, 6.5) },
  { pos: roadFrame(0.87, 0, 6), look: roadFrame(0.97, 0, 7) },
  { pos: roadFrame(0.925, 0, 6), look: roadFrame(1, 0, 9) },
  // 5 Contact: road end, looking across the lake at Sangsad Bhaban.
  {
    stop: 5,
    pos: roadFrame(0.965, 0, 6),
    look: SANGSAD_POSITION.clone().setY(16),
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
