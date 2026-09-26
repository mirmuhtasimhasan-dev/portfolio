import { CatmullRomCurve3, Vector3 } from "three";
import { SECTION_COUNT, projectSectionId, sectionIndex } from "./sections";
import { BILLBOARDS, BRIDGE_EYE, BRIDGE_TO, GANTRY_A, GANTRY_EYE } from "./bridge";
import { SANGSAD_POSITION, roadFrame } from "./road";

export {
  ROAD_HALF_WIDTH,
  roadCurve,
  ROAD_LENGTH,
  roadFrame,
  LAKE_CENTER,
  LAKE_RADIUS,
  SANGSAD_POSITION,
} from "./road";

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
  { stop: sectionIndex("hero"), pos: new Vector3(0, 80, 108), look: new Vector3(18, 34, -260) },
  // Dive down the road corridor.
  { pos: new Vector3(0, 46, 52), look: roadFrame(0.27, 0, 8) },
  { pos: roadFrame(0.1, 0, 15), look: roadFrame(0.26, 0, EYE + 1) },
  // 1 About: road center, residential building ahead on the right.
  { stop: sectionIndex("about"), pos: roadFrame(0.18, 0, EYE), look: roadFrame(0.215, 12, EYE) },
  { pos: roadFrame(0.245, 0, EYE), look: roadFrame(0.33, 0, EYE) },
  // 2 Credentials: road center, the next building ahead on the left.
  // Framed so every floor banner and the signboard beside it are in view.
  { stop: sectionIndex("credentials"), pos: roadFrame(0.29, 0, EYE), look: roadFrame(0.32, -14, EYE + 1) },
  { pos: roadFrame(0.36, 0, EYE), look: roadFrame(0.46, 0, EYE) },
  // 3 Toolset, Frontend street: looking down the shop signboards.
  { stop: sectionIndex("toolset"), pos: roadFrame(0.42, 0, EYE), look: roadFrame(0.47, 0, EYE + 1) },
  // 4 Toolset, Backend gali: past the shop boards, the row of tall signs ahead.
  { stop: sectionIndex("gali"), pos: roadFrame(0.502, 0, EYE), look: roadFrame(0.545, 0, EYE + 1) },
  // 5 Toolset, Server roof: further on, looking up at the rooftop line ahead.
  { stop: sectionIndex("roof"), pos: roadFrame(0.528, 0, EYE), look: roadFrame(0.59, 0, 12) },
  { pos: roadFrame(0.565, 0, EYE + 1.5), look: roadFrame(0.66, 0, 5) },
  // Projects: the gantry over the road, just before the bridge.
  { stop: sectionIndex("projects"), pos: roadFrame(GANTRY_A - 0.034, 0, GANTRY_EYE), look: roadFrame(GANTRY_A, 0, 9.6) },
  // One hold per billboard, looking at it; waypoints between follow the road.
  ...BILLBOARDS.flatMap((b, i): Key[] => {
    const hold: Key = { stop: sectionIndex(projectSectionId(b.project.slug)), pos: b.hold.clone(), look: b.position.clone() };
    const prev = i === 0 ? GANTRY_A - 0.034 : BILLBOARDS[i - 1].holdA;
    const midA = (prev + b.holdA) / 2;
    return [{ pos: roadFrame(midA, 0, BRIDGE_EYE), look: roadFrame(midA + 0.09, 0, BRIDGE_EYE + 0.6) }, hold];
  }),
  // Off the bridge toward the lake, keeping to the road through the bend.
  // (every 0.035 of road from the last hold, so the path never cuts the bend).
  ...Array.from({ length: 40 }, (_, i) => (BILLBOARDS.at(-1)?.holdA ?? GANTRY_A) + 0.035 * (i + 1))
    .filter((a) => a < 0.94)
    .map((a): Key => ({ pos: roadFrame(a, 0, a < BRIDGE_TO ? BRIDGE_EYE : 6), look: roadFrame(Math.min(1, a + 0.08), 0, 7) })),
  // Contact: road end, looking across the lake at Sangsad Bhaban.
  {
    stop: sectionIndex("contact"),
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
