import { SECTIONS, SECTION_COUNT } from "./sections";

/*
 * Stop map: master progress (0..1) -> stop space s (0..SECTION_COUNT-1).
 * Integer s = exactly at a section's camera stop.
 *
 * The scroll range is split into N hold zones and N-1 travel zones.
 * Each section owns a share of scroll proportional to its weight (sections.ts).
 * Its hold is HOLD_RATIO (~40%) of that share, during which s only drifts by
 * +-HOLD_DRIFT so the camera is almost still. The rest of each share is split
 * between the travels on either side, which use an ease-in-out curve.
 */
const N = SECTION_COUNT;
const HOLD_RATIO = 0.4;
const HOLD_DRIFT = 0.025;
const TRAVEL_SIDE = (1 - HOLD_RATIO) / 2;

const W = SECTIONS.map((sec) => sec.weight);
const holdLen = W.map((w) => HOLD_RATIO * w);
const travelLen = W.slice(0, -1).map((w, i) => TRAVEL_SIDE * (w + W[i + 1]));
const total = holdLen.reduce((a, b) => a + b, 0) + travelLen.reduce((a, b) => a + b, 0);

export type Zone = { kind: "hold" | "travel"; index: number; start: number; end: number };

export const ZONES: Zone[] = [];
{
  let p = 0;
  for (let i = 0; i < N; i++) {
    const h = holdLen[i] / total;
    ZONES.push({ kind: "hold", index: i, start: p, end: p + h });
    p += h;
    if (i < N - 1) {
      const t = travelLen[i] / total;
      ZONES.push({ kind: "travel", index: i, start: p, end: p + t });
      p += t;
    }
  }
}

/** Progress value at the center of each section's hold zone. */
export const HOLD_CENTERS = ZONES.filter((z) => z.kind === "hold").map(
  (z) => (z.start + z.end) / 2
);

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function progressToStop(progress: number): number {
  const p = clamp(progress, 0, 1);
  for (const z of ZONES) {
    if (p > z.end && z !== ZONES[ZONES.length - 1]) continue;
    const t = clamp((p - z.start) / (z.end - z.start), 0, 1);
    const i = z.index;
    if (z.kind === "hold") {
      // First and last holds only drift inward so s stays in [0, N-1].
      const from = i === 0 ? 0 : i - HOLD_DRIFT;
      const to = i === N - 1 ? N - 1 : i + HOLD_DRIFT;
      return from + (to - from) * t;
    }
    const from = i + HOLD_DRIFT;
    const to = i + 1 - HOLD_DRIFT;
    return from + (to - from) * easeInOutCubic(t);
  }
  return N - 1;
}

const HOLDS = ZONES.filter((z) => z.kind === "hold");
const TRAVELS = ZONES.filter((z) => z.kind === "travel");
export { HOLDS };

/** Progress at a given phase (0..1) through section i's hold. */
export const holdProgress = (i: number, phase: number) =>
  HOLDS[i].start + (HOLDS[i].end - HOLDS[i].start) * phase;

/**
 * Where master progress is relative to section i, for timing in-scene effects:
 * -1..0 during the incoming travel, 0..1 through the hold, 1..2 during the
 * outgoing travel. Clamped at the ends. Pure function of progress, so
 * scrolling up reverses every effect exactly.
 */
export function sectionPhase(progress: number, i: number): number {
  const hold = HOLDS[i];
  if (progress < hold.start) {
    if (i === 0) return 0;
    const t = TRAVELS[i - 1];
    return Math.max(-1, (progress - hold.start) / (t.end - t.start));
  }
  if (progress <= hold.end) return (progress - hold.start) / (hold.end - hold.start);
  if (i === N - 1) return 1;
  const t = TRAVELS[i];
  return Math.min(2, 1 + (progress - hold.end) / (t.end - t.start));
}

/** Nearest section index for a stop-space value. */
export const stopToSection = (s: number) => clamp(Math.round(s), 0, N - 1);

/**
 * Overlay opacity for section i from stop space. Fully visible through the
 * hold, fades out early in the travel so text is gone before the camera moves far.
 */
export function sectionOpacity(s: number, i: number): number {
  const d = Math.abs(s - i);
  const a = 0.08;
  const b = 0.3;
  if (d <= a) return 1;
  if (d >= b) return 0;
  const t = (d - a) / (b - a);
  return 1 - t * t * (3 - 2 * t);
}
