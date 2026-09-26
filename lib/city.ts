import { BoxGeometry, Color, EdgesGeometry, Vector3 } from "three";
import { mulberry32 } from "./random";
import { palette } from "./palette";
import { CONTENT_LOTS, FLOOR_HEIGHT, SIDEWALK } from "./contentBuildings";
import { ABOUT_TIMING } from "./timeline";
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
 * Line hierarchy: every generated building is line-base. Bright green is kept
 * for the buildings that carry section content (see contentBuildings.ts).
 * Floor lines and rooftop details are flagged as "detail" so the shader can
 * fade them out with distance (moire).
 */

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
  /** Roof height (without rooftop structures). */
  roof: number;
  /** Street frontage only: where it stands along the road. */
  frontage?: {
    a: number;
    side: 1 | -1;
    /** Distance from the road center to the road-facing facade. */
    facade: number;
    /** Half size along the road. */
    halfWidth: number;
  };
};

/** Window slots for the lit-city moment (instanced quads). */
export type WindowSlots = {
  /** xyz per window, on the facade. */
  offsets: Float32Array;
  /** Width, height per window. */
  sizes: Float32Array;
  /** Facade normal angle (atan2(nx, nz)). */
  yaws: Float32Array;
  /** About-phase at which this window switches off. */
  offAt: Float32Array;
  /** 0..1 brightness variation. */
  seeds: Float32Array;
  count: number;
};

export type CityBuffers = {
  windows: WindowSlots;
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

/** Window size (m) and layout on a facade. */
const WIN_W = 1.2;
const WIN_H = 1.5;
const WIN_MARGIN = 0.9;
const WIN_GAP = 1.3;

/*
 * Lit windows for "lockdown night". Only on the wall that faces the road,
 * on a regular grid (one row per floor, even columns, same size), flush on
 * the facade. Not every building has them and not every window is lit.
 * Switch-off times are shared per building floor (small jitter inside), so
 * windows go dark in small clusters, not as random single squares.
 */
class WindowWriter {
  off: number[] = [];
  size: number[] = [];
  yaw: number[] = [];
  offAt: number[] = [];
  seed: number[] = [];
  constructor(private rand: () => number, private offFrom: number, private offTo: number) {}

  /**
   * One facade of a box (local X size sx, Z size sz, rotated by yaw).
   * (nx, nz) is the local face normal: (+-1, 0) or (0, +-1).
   */
  addFacade(
    x: number, z: number, sx: number, sz: number, yaw: number, floors: number,
    nx: number, nz: number, litP: number
  ) {
    const r = this.rand;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const span = nx !== 0 ? sz : sx;
    const usable = span - 2 * WIN_MARGIN;
    const cols = Math.max(1, Math.floor((usable + WIN_GAP) / (WIN_W + WIN_GAP)));
    const step = usable / cols;
    const wyaw = Math.atan2(nx * c + nz * s, -nx * s + nz * c);
    for (let f = 1; f < floors; f++) {
      // One switch-off moment per floor of this building, a little jitter inside.
      const floorOff = this.offFrom + (this.offTo - this.offFrom - 0.02) * r();
      for (let k = 0; k < cols; k++) {
        if (r() > litP) continue;
        const t = -span / 2 + WIN_MARGIN + step * (k + 0.5);
        const lx = nx !== 0 ? nx * (sx / 2 + 0.04) : t;
        const lz = nz !== 0 ? nz * (sz / 2 + 0.04) : t;
        this.off.push(x + lx * c + lz * s, f * FLOOR_HEIGHT + 0.8 + WIN_H / 2, z - lx * s + lz * c);
        this.size.push(WIN_W, WIN_H);
        this.yaw.push(wyaw);
        this.offAt.push(floorOff + r() * 0.02);
        this.seed.push(r());
      }
    }
  }

  build(): WindowSlots {
    return {
      offsets: new Float32Array(this.off),
      sizes: new Float32Array(this.size),
      yaws: new Float32Array(this.yaw),
      offAt: new Float32Array(this.offAt),
      seeds: new Float32Array(this.seed),
      count: this.yaw.length,
    };
  }
}

/** Local face normal of a box (yawed) that points most toward direction (dx, dz). */
function faceToward(yaw: number, dx: number, dz: number): [number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  let best: [number, number] = [1, 0];
  let bestDot = -Infinity;
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
    const d = (nx * c + nz * s) * dx + (-nx * s + nz * c) * dz;
    if (d > bestDot) {
      bestDot = d;
      best = [nx, nz];
    }
  }
  return best;
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
  floorLines: boolean
): Footprint {
  const h = floors * FLOOR_HEIGHT;
  w.add(boxEdges, width, h, depth, yaw, x, 0, z, BASE, 0);

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
  return { x, z, sx: width, sz: depth, yaw, top, roof: h };
}

/** Varied Dhaka skyline: mostly 5-10 storeys, some low, some tall, a few towers. */
function dhakaFloors(rand: () => number) {
  const r = rand();
  if (r < 0.15) return 2 + Math.floor(rand() * 3);
  if (r < 0.8) return 5 + Math.floor(rand() * 6);
  if (r < 0.94) return 11 + Math.floor(rand() * 5);
  return 16 + Math.floor(rand() * 11);
}

// Which buildings get lit windows, and how many of their window slots are lit.
const WINDOW_BUILDING_P_FRONTAGE = 0.8;
const WINDOW_BUILDING_P_GRID = 0.55;
const WINDOW_LIT_P = 0.55;

export function generateCity(seed = 1971): CityBuffers {
  const rand = mulberry32(seed);
  // Separate stream so windows never change the building layout.
  const winRand = mulberry32(seed + 1);
  const win = new WindowWriter(winRand, ABOUT_TIMING.offFrom, ABOUT_TIMING.offTo);
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
      let off = ROAD_HALF_WIDTH + SIDEWALK + depth / 2 + rand() * 1.5;
      // On bends a corner can poke past the sidewalk line: push the building back.
      const yawT = Math.atan2(t.x, t.z);
      const cy = Math.cos(yawT);
      const sy = Math.sin(yawT);
      for (let pass = 0; pass < 2; pass++) {
        const cx0 = p.x + rx * off * side;
        const cz0 = p.z + rz * off * side;
        let closest = Infinity;
        for (const [lx, lz] of [[-depth / 2, -width / 2], [-depth / 2, width / 2], [depth / 2, -width / 2], [depth / 2, width / 2]]) {
          closest = Math.min(closest, nearestRoad(samples, cx0 + lx * cy + lz * sy, cz0 - lx * sy + lz * cy).dist);
        }
        const deficit = ROAD_HALF_WIDTH + SIDEWALK - closest;
        if (deficit <= 0) break;
        off += deficit + 0.2;
      }
      const x = p.x + rx * off * side;
      const z = p.z + rz * off * side;

      if (isReserved(x, z)) continue;
      // Keep content lots empty (with the building's own half width as margin).
      const halfA = width / 2 / ROAD_LENGTH;
      if (
        CONTENT_LOTS.some(
          (l) => l.side === side && a + halfA > l.aFrom && a - halfA < l.aTo
        )
      )
        continue;

      const low = inHatirjheel({ dist: off, a });
      const floors = low ? 1 + Math.floor(rand() * 3) : 5 + Math.floor(rand() * 6);
      const yaw = Math.atan2(t.x, t.z);
      // local Z runs along the road: width along Z, depth along X.
      const fp = addBuilding(w, rand, x, z, depth, width, floors, yaw, true);
      fp.frontage = { a, side: side as 1 | -1, facade: off - depth / 2, halfWidth: width / 2 };
      footprints.push(fp);
      // Road-facing wall: local +X * side points at the road.
      if (winRand() < WINDOW_BUILDING_P_FRONTAGE) {
        win.addFacade(x, z, depth, width, yaw, floors, side, 0, WINDOW_LIT_P);
      }
    }
  }

  // 2. Fill the rest of the city: a tight grid with narrow gaps, like Dhaka.
  const CELL = 12;
  for (let gx = -340; gx <= 380; gx += CELL) {
    for (let gz = 180; gz >= -780; gz -= CELL) {
      if (rand() < 0.05) continue; // the odd open plot or pond
      const x = gx + (rand() - 0.5) * 1.5;
      const z = gz + (rand() - 0.5) * 1.5;
      const near = nearestRoad(samples, x, z);
      if (near.dist < ROAD_HALF_WIDTH + SIDEWALK + 28) continue;
      if (isReserved(x, z)) continue;

      // Sizes and jitter keep a 1-5 m gap between neighbours, never overlapping.
      const width = 7 + rand() * 3;
      const depth = 7 + rand() * 3;
      const floors = inHatirjheel(near) ? 1 + Math.floor(rand() * 3) : dhakaFloors(rand);
      const yaw = (rand() - 0.5) * 0.08;
      footprints.push(addBuilding(w, rand, x, z, width, depth, floors, yaw, near.dist < 70));
      if (winRand() < WINDOW_BUILDING_P_GRID) {
        const rp = roadCurve.getPointAt(near.a);
        const [nx, nz] = faceToward(yaw, rp.x - x, rp.z - z);
        win.addFacade(x, z, width, depth, yaw, floors, nx, nz, WINDOW_LIT_P);
      }
    }
  }

  return {
    windows: win.build(),
    positions: new Float32Array(w.pos),
    colors: new Float32Array(w.col),
    detail: new Float32Array(w.det),
    footprints,
    buildingCount: footprints.length,
  };
}

let cached: CityBuffers | null = null;
/** The city is deterministic; generate it once and share it between components. */
export const getCity = () => (cached ??= generateCity());
