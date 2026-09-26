import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/*
 * Turns a 24 x 24 SVG path (simple-icons) into line segments for a neon tube:
 * the outline of every subpath, centered and normalized to a 1 x 1 square
 * (y up). Client only (SVGLoader uses DOMParser). Cached per path.
 */

const cache = new Map<string, number[]>();

export function logoSegments(d: string): number[] {
  const hit = cache.get(d);
  if (hit) return hit;
  const loader = new SVGLoader();
  const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${d}"/></svg>`);
  const out: number[] = [];
  for (const path of data.paths) {
    for (const sub of path.subPaths) {
      const pts = sub.getPoints(10);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        out.push((a.x - 12) / 24, -(a.y - 12) / 24, 0, (b.x - 12) / 24, -(b.y - 12) / 24, 0);
      }
    }
  }
  cache.set(d, out);
  return out;
}
