import { BoxGeometry, EdgesGeometry, Vector3 } from "three";
import { mulberry32 } from "./random";
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
 */

const FLOOR_HEIGHT = 3.2;
const SIDEWALK = 3;
// Hatirjheel stretch: kept open for the bridge and water (phase 4).
const HATIRJHEEL = { from: 0.6, to: 0.88, clearance: 55 };

export type CityBuffers = {
  /** Building edges, floor lines, rooftop tanks. */
  positions: Float32Array;
  /** 0..1 per vertex: 1 = street frontage (drawn slightly brighter). */
  emphasis: Float32Array;
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

class LineWriter {
  pos: number[] = [];
  emph: number[] = [];

  /** Append a template scaled by (sx, sy, sz), rotated by yaw, moved to (x, y, z). */
  add(
    tpl: Float32Array,
    sx: number, sy: number, sz: number,
    yaw: number,
    x: number, y: number, z: number,
    emphasis: number
  ) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (let i = 0; i < tpl.length; i += 3) {
      const lx = tpl[i] * sx;
      const ly = tpl[i + 1] * sy;
      const lz = tpl[i + 2] * sz;
      this.pos.push(x + lx * c + lz * s, y + ly, z - lx * s + lz * c);
      this.emph.push(emphasis);
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

function isReserved(x: number, z: number, near: { dist: number; a: number }) {
  if (near.a > HATIRJHEEL.from && near.a < HATIRJHEEL.to && near.dist < HATIRJHEEL.clearance)
    return true;
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
  detail: boolean,
  emphasis: number
) {
  const h = floors * FLOOR_HEIGHT;
  w.add(boxEdges, width, h, depth, yaw, x, 0, z, emphasis);

  if (detail) {
    for (let f = 1; f < floors; f++) {
      w.add(ringEdges, width, 1, depth, yaw, x, f * FLOOR_HEIGHT, z, emphasis);
    }
  }

  // Dhaka rooftops: water tanks and stair rooms.
  if (rand() < 0.55) {
    const tw = 1.6 + rand() * 1.4;
    const ox = (rand() - 0.5) * (width - tw) * 0.8;
    const oz = (rand() - 0.5) * (depth - tw) * 0.8;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    w.add(boxEdges, tw, 1.4 + rand(), tw, yaw, x + ox * c + oz * s, h, z - ox * s + oz * c, emphasis);
  }
  if (rand() < 0.35) {
    const sw = 3 + rand() * 2;
    const ox = (rand() - 0.5) * (width - sw) * 0.6;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    w.add(boxEdges, sw, 2.6, sw * 0.8, yaw, x + ox * c, h, z - ox * s, emphasis);
  }
}

export function generateCity(seed = 1971): CityBuffers {
  const rand = mulberry32(seed);
  const w = new LineWriter();
  const samples = buildRoadSamples(700);
  let count = 0;

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

      if (isReserved(x, z, { dist: off, a })) continue;

      const floors = 5 + Math.floor(rand() * 6);
      const yaw = Math.atan2(t.x, t.z);
      // local Z runs along the road: width along Z, depth along X.
      addBuilding(w, rand, x, z, depth, width, floors, yaw, true, 1);
      count++;
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
      if (isReserved(x, z, near)) continue;

      const width = 7 + rand() * 7;
      const depth = 7 + rand() * 7;
      const tower = rand() < 0.06;
      const floors = tower ? 14 + Math.floor(rand() * 10) : 4 + Math.floor(rand() * 8);
      const yaw = (rand() - 0.5) * 0.2;
      addBuilding(w, rand, x, z, width, depth, floors, yaw, near.dist < 70, 0);
      count++;
    }
  }

  return {
    positions: new Float32Array(w.pos),
    emphasis: new Float32Array(w.emph),
    buildingCount: count,
  };
}
