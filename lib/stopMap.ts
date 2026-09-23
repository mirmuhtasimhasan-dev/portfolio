import { SECTION_COUNT } from "./sections";

/*
 * Stop map: master progress (0..1) -> stop space s (0..SECTION_COUNT-1).
 * Integer s = exactly at a section's camera stop.
 *
 * The scroll range is split into N hold zones and N-1 travel zones.
 * Each hold is ~40% of a section's share of scroll (HOLD_RATIO), during which
 * s only drifts by +-HOLD_DRIFT so the camera is almost still. Travel zones
 * cover the rest with an ease-in-out curve.
 */
const N = SECTION_COUNT;
const HOLD_RATIO = 0.4;
const HOLD_DRIFT = 0.025;

// N*H + (N-1)*T = 1 and H / (H + T) = HOLD_RATIO
const unit = 1 / (N * HOLD_RATIO + (N - 1) * (1 - HOLD_RATIO));
const H = HOLD_RATIO * unit;
const T = (1 - HOLD_RATIO) * unit;

export type Zone = { kind: "hold" | "travel"; index: number; start: number; end: number };

export const ZONES: Zone[] = [];
{
  let p = 0;
  for (let i = 0; i < N; i++) {
    ZONES.push({ kind: "hold", index: i, start: p, end: p + H });
    p += H;
    if (i < N - 1) {
      ZONES.push({ kind: "travel", index: i, start: p, end: p + T });
      p += T;
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
