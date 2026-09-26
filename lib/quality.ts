/**
 * Per-device atmosphere settings (client only). Bloom on desktop only; fewer
 * rain streaks on phones; no rain at all when motion is reduced.
 */
export type Quality = { phone: boolean; reduced: boolean; bloom: boolean; rain: number };

export function getQuality(): Quality {
  if (typeof window === "undefined") return { phone: false, reduced: false, bloom: false, rain: 0 };
  const phone = window.matchMedia("(max-width: 768px), (hover: none) and (pointer: coarse)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    phone,
    reduced,
    bloom: !phone && !reduced,
    rain: reduced ? 0 : phone ? 400 : 1400,
  };
}
