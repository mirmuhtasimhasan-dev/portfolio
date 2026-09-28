import { Vector3 } from "three";
import { buildCable, getBazaar } from "./bazaar";
import { PLATE, PLATES } from "./plates";
import { mulberry32 } from "./random";
import { roadFrame } from "./road";

/*
 * Tangled Dhaka electric wires over the tech-stack street (an ambient detail,
 * see SPEC.md): poles at the kerb, loose sagging wires along both sides and
 * across the road, small tangles at the pole tops. Pure geometry, so the
 * layout can be checked against every sign from every hold.
 */
export const WIRES = { from: 0.405, to: 0.508, lateral: 9.2, top: 13.8, minY: 12 };

/** Line-segment positions (xyz pairs) for the wires at a viewport size. */
export function buildWires(width: number, height: number): number[] {
  const rnd = mulberry32(4107);
  const p: number[] = [];
  const seg = (a: Vector3, b: Vector3) => p.push(a.x, a.y, a.z, b.x, b.y, b.z);
  // Sagging wire between two pole tops; never below minY (8.5 m over the eye).
  const wire = (a: Vector3, b: Vector3, sag: number) => {
    let prev = a;
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      const q = a.clone().lerp(b, t);
      q.y = Math.max(WIRES.minY, q.y - sag * 4 * t * (1 - t));
      seg(prev, q);
      prev = q;
    }
  };
  // Left poles: the existing cable poles in the stretch. Right poles only
  // where no shop sign stands, so no pole crosses a board.
  const cablePoles = buildCable().poles.filter((q, i) => i % 2 === 0 && inStretch(q));
  const left = cablePoles.map((q) => q.clone().setY(0));
  const signs = getBazaar(width, height).filter((s) => s.side === 1);
  const clear = (q: Vector3) =>
    signs.every((s) => Math.hypot(s.position.x - q.x, s.position.z - q.z) > s.width / 2 + 2.5) &&
    PLATES.every((s) => Math.hypot(s.position.x - q.x, s.position.z - q.z) > PLATE.w / 2 + 2.5);
  const right: Vector3[] = [];
  for (let a = WIRES.from; a <= WIRES.to; a += 0.009) {
    const q = roadFrame(a, WIRES.lateral, 0);
    if (clear(q)) right.push(q);
  }
  const poles = [...left, ...right];
  for (const q of right) {
    seg(q, q.clone().setY(WIRES.top));
    seg(q.clone().setY(WIRES.top - 0.6).addScaledVector(alongRoadDir(q), -0.6), q.clone().setY(WIRES.top - 0.6).addScaledVector(alongRoadDir(q), 0.6));
  }
  // Left poles already rise to the cable; extend them to the wire height.
  for (const q of cablePoles) seg(q, q.clone().setY(WIRES.top));
  // Along each side: a few loose wires between neighbouring poles.
  for (const side of [left, right]) {
    for (let i = 0; i + 1 < side.length; i++) {
      const n = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const y0 = WIRES.top - 0.2 - rnd() * 1.2;
        const y1 = WIRES.top - 0.2 - rnd() * 1.2;
        wire(side[i].clone().setY(y0), side[i + 1].clone().setY(y1), 0.6 + rnd() * 1.0);
      }
    }
  }
  // Across the road: every right pole to a left pole a little ahead or behind.
  for (const q of right) {
    const others = [...left].sort((m, n) => m.distanceTo(q) - n.distanceTo(q));
    for (const l of others.slice(0, 1 + Math.floor(rnd() * 2))) {
      wire(q.clone().setY(WIRES.top - 0.3 - rnd() * 0.5), l.clone().setY(WIRES.top - 0.3 - rnd() * 0.5), 0.8 + rnd() * 0.6);
    }
  }
  // A tangle at each pole top: small loops wound around it.
  for (const q of poles) {
    const loops = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < loops; k++) {
      const r = 0.25 + rnd() * 0.35;
      const y = WIRES.top - 0.4 - rnd() * 1.0;
      const tilt = (rnd() - 0.5) * 0.8;
      let prev: Vector3 | null = null;
      for (let i = 0; i <= 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const v = new Vector3(q.x + Math.cos(ang) * r, y + Math.sin(ang) * r * tilt - (Math.sin(ang) > 0 ? 0 : 0.15), q.z + Math.sin(ang) * r);
        if (prev) seg(prev, v);
        prev = v;
      }
    }
  }
  return p;
}

/** Road fraction nearest to a ground point (sampled over the wire stretch). */
function nearestA(q: Vector3) {
  let best = Infinity;
  let bestA = 0;
  for (let a = WIRES.from - 0.02; a <= WIRES.to + 0.02; a += 0.001) {
    const r = roadFrame(a, 0, 0);
    const d = (r.x - q.x) ** 2 + (r.z - q.z) ** 2;
    if (d < best) {
      best = d;
      bestA = a;
    }
  }
  return bestA;
}
const inStretch = (q: Vector3) => {
  const a = nearestA(q);
  return a >= WIRES.from && a <= WIRES.to;
};
const alongRoadDir = (q: Vector3) => {
  const a = nearestA(q);
  return roadFrame(a + 0.001, 0, 0).sub(roadFrame(a, 0, 0)).normalize();
};

