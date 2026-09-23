import { BoxGeometry, Color, EdgesGeometry, Vector3 } from "three";
import { mulberry32 } from "./random";
import { palette } from "./palette";
import {
  LAKE_CENTER,
  LAKE_RADIUS,
  ROAD_HALF_WIDTH,
  ROAD_LENGTH,
  SANGSAD_POSITION,
  roadCurve,
} from "./paths";

/*
 * Code-generated city. Every building is the EdgesGeometry of a unit box,
 * scaled/rotated/translated and appended to one big position buffer, so the
 * whole city is a single LineSegments draw call.
 *
 * Line hierarchy: almost everything is line-base; a small share of buildings
 * (NEON_SHARE) get bright green outlines. Floor lines and rooftop details are
 * flagged as "detail" so the shader can fade them out with distance (moire).
 */

const FLOOR_HEIGHT = 3.2;
/** Facades start at ROAD_HALF_WIDTH + SIDEWALK = 9 m from the road center. */
export const SIDEWALK = 4;
const NEON_SHARE = 0.11;
// Hatirjheel stretch: low buildings only until the bridge arrives (phase 4).
const HATIRJHEEL = { from: 0.6, to: 0.9, clearance: 60 };

export type Footprint = {
  x: number;
  z: number;
  /** Size along local X / local Z. */
  sx: number;
  sz: number;
  yaw: number;
  /** Top including rooftop structures. */
  top: number;
};

export type CityBuffers = {
  positions: Float32Array;
  colors: Float32Array;
  /** 1 = floor line / rooftop detail (faded out with distance), 0 = main edge. */
  detail: Float32Array;
  footprints: Footprint[];
  buildingCount: number;
};

// Unit box with base at y=0, as edge pairs.
const boxEdges = (() => {
  const g = new BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  const e = new EdgesGeometry(g);
  const arr = Float32Array.from(e.attributes.position.array as ArrayLike<number>);
  g.dispose();
  e.dispose();
  return arr;
})();

// One horizontal floor ring (square outline) at y = 0.
const ringEdges = new Float32Array([
  -0.5, 0, -0.5, 0.5, 0, -0.5,
  0.5, 0, -0.5, 0.5, 0, 0.5,
  0.5, 0, 0.5, -0.5, 0, 0.5,
  -0.5, 0, 0.5, -0.5, 0, -0.5,
]);

const BASE = new Color(palette.lineBase);
const NEON = new Color(palette.green);

class LineWriter {
  pos: number[] = [];
  col: number[] = [];
  det: number[] = [];

  /** Append a template scaled by (sx, sy, sz), rotated by yaw, moved to (x, y, z). */
  add(
    tpl: Float32Array,
    sx: number, sy: number, sz: number,
    yaw: number,
    x: number, y: number, z: number,
    color: Color,
    detail: number
  ) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (let i = 0; i < tpl.length; i += 3) {
      const lx = tpl[i] * sx;
      const ly = tpl[i + 1] * sy;
      const lz = tpl[i + 2] * sz;
      this.pos.push(x + lx * c + lz * s, y + ly, z - lx * s + lz * c);
      this.col.push(color.r, color.g, color.b);
      this.det.push(detail);
    }
  }
}

type RoadSample = { p: Vector3; a: number };

function buildRoadSamples(count: number): RoadSample[] {
  const out: RoadSample[] = [];
  for (let i = 0; i <= count; i++) {
    const a = i / count;
    out.push({ p: roadCurve.getPointAt(a), a });
  }
  return out;
}

function nearestRoad(samples: RoadSample[], x: number, z: number) {
  let best = Infinity;
  let a = 0;
  for (const s of samples) {
    const dx = s.p.x - x;
    const dz = s.p.z - z;
    const d = dx * dx + dz * dz;
    if (d < best) {
      best = d;
      a = s.a;
    }
  }
  return { dist: Math.sqrt(best), a };
}

const inHatirjheel = (near: { dist: number; a: number }) =>
  near.a > HATIRJHEEL.from && near.a < HATIRJHEEL.to && near.dist < HATIRJHEEL.clearance;

function isReserved(x: number, z: number) {
  if (Math.hypot(x - LAKE_CENTER.x, z - LAKE_CENTER.z) < LAKE_RADIUS + 20) return true;
  if (Math.hypot(x - SANGSAD_POSITION.x, z - SANGSAD_POSITION.z) < 80) return true;
  return false;
}

function addBuilding(
  w: LineWriter,
  rand: () => number,
  x: number, z: number,
  width: number, depth: number, floors: number,
  yaw: number,
  floorLines: boolean,
  neon: boolean
): Footprint {
  const h = floors * FLOOR_HEIGHT;
  w.add(boxEdges, width, h, depth, yaw, x, 0, z, neon ? NEON : BASE, 0);

  if (floorLines) {
    for (let f = 1; f < floors; f++) {
      w.add(ringEdges, width, 1, depth, yaw, x, f * FLOOR_HEIGHT, z, BASE, 1);
    }
  }

  let top = h;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // Dhaka rooftops: water tanks and stair rooms.
  if (rand() < 0.55) {
    const tw = 1.6 + rand() * 1.4;
    const th = 1.4 + rand();
    const ox = (rand() - 0.5) * (width - tw) * 0.8;
    const oz = (rand() - 0.5) * (depth - tw) * 0.8;
    w.add(boxEdges, tw, th, tw, yaw, x + ox * c + oz * s, h, z - ox * s + oz * c, BASE, 1);
    top = Math.max(top, h + th);
  }
  if (rand() < 0.35) {
    const sw = 3 + rand() * 2;
    const ox = (rand() - 0.5) * (width - sw) * 0.6;
    w.add(boxEdges, sw, 2.6, sw * 0.8, yaw, x + ox * c, h, z - ox * s, BASE, 1);
    top = Math.max(top, h + 2.6);
  }
  return { x, z, sx: width, sz: depth, yaw, top };
}

export function generateCity(seed = 1971): CityBuffers {
  const rand = mulberry32(seed);
  const w = new LineWriter();
  const samples = buildRoadSamples(700);
  const footprints: Footprint[] = [];

  // 1. Street frontage: packed buildings lining both sides of the road.
  for (const side of [-1, 1]) {
    let d = 4;
    while (d < ROAD_LENGTH - 4) {
      const width = 8 + rand() * 8;
      const depth = 10 + rand() * 8;
      const a = (d + width / 2) / ROAD_LENGTH;
      d += width + 0.8 + rand() * 1.6;
      if (a > 1) break;

      const p = roadCurve.getPointAt(a);
      const t = roadCurve.getTangentAt(a);
      // right vector = tangent x up
      const rx = -t.z;
      const rz = t.x;
      const off = ROAD_HALF_WIDTH + SIDEWALK + depth / 2 + rand() * 1.5;
      const x = p.x + rx * off * side;
      const z = p.z + rz * off * side;

      if (isReserved(x, z)) continue;

      const low = inHatirjheel({ dist: off, a });
      const floors = low ? 1 + Math.floor(rand() * 3) : 5 + Math.floor(rand() * 6);
      const yaw = Math.atan2(t.x, t.z);
      const neon = rand() < NEON_SHARE;
      // local Z runs along the road: width along Z, depth along X.
      footprints.push(addBuilding(w, rand, x, z, depth, width, floors, yaw, true, neon));
    }
  }

  // 2. Fill the rest of the city on a jittered grid.
  const CELL = 17;
  for (let gx = -340; gx <= 380; gx += CELL) {
    for (let gz = 180; gz >= -780; gz -= CELL) {
      if (rand() < 0.12) continue; // open plots, ponds, playgrounds
      const x = gx + (rand() - 0.5) * 5;
      const z = gz + (rand() - 0.5) * 5;
      const near = nearestRoad(samples, x, z);
      if (near.dist < ROAD_HALF_WIDTH + SIDEWALK + 28) continue;
      if (isReserved(x, z)) continue;

      const width = 7 + rand() * 7;
      const depth = 7 + rand() * 7;
      const low = inHatirjheel(near);
      const tower = !low && rand() < 0.06;
      const floors = low
        ? 1 + Math.floor(rand() * 3)
        : tower
          ? 14 + Math.floor(rand() * 10)
          : 4 + Math.floor(rand() * 8);
      const yaw = (rand() - 0.5) * 0.2;
      const neon = rand() < NEON_SHARE;
      footprints.push(addBuilding(w, rand, x, z, width, depth, floors, yaw, near.dist < 70, neon));
    }
  }

  return {
    positions: new Float32Array(w.pos),
    colors: new Float32Array(w.col),
    detail: new Float32Array(w.det),
    footprints,
    buildingCount: footprints.length,
  };
}
