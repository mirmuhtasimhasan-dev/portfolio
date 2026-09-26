import { CylinderGeometry, EdgesGeometry, Vector3 } from "three";
import {
  ABOUT_COLS,
  ABOUT_FLOORS,
  ABOUT_LOT,
  ABOUT_WINDOW,
  BALCONY_DEPTH,
  FLOOR_HEIGHT,
  aboutWindowLocal,
  lotToWorld,
} from "./contentBuildings";

/*
 * The About building as a Mohammadpur house, in lot-local coordinates:
 * floor slabs, grilled windows, a grilled balcony per floor, a gate on the
 * ground floor, a roof parapet, a stair room and water tanks on a stand.
 * `outline` is drawn bright green (content building), `detail` dimmer.
 */

type Seg = number[];

const push = (arr: Seg, a: Vector3 | number[], b: Vector3 | number[]) => {
  const p = Array.isArray(a) ? a : [a.x, a.y, a.z];
  const q = Array.isArray(b) ? b : [b.x, b.y, b.z];
  arr.push(p[0], p[1], p[2], q[0], q[1], q[2]);
};

function box(arr: Seg, cx: number, y0: number, cz: number, sx: number, sy: number, sz: number) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, y1 = y0 + sy;
  for (const y of [y0, y1]) {
    push(arr, [x0, y, z0], [x1, y, z0]);
    push(arr, [x1, y, z0], [x1, y, z1]);
    push(arr, [x1, y, z1], [x0, y, z1]);
    push(arr, [x0, y, z1], [x0, y, z0]);
  }
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) push(arr, [x, y0, z], [x, y1, z]);
}

/** Rectangle on the facade plane (x fixed) with optional grill bars. */
function facadeRect(arr: Seg, x: number, y0: number, y1: number, z0: number, z1: number, bars = 0, midBar = false) {
  push(arr, [x, y0, z0], [x, y0, z1]);
  push(arr, [x, y0, z1], [x, y1, z1]);
  push(arr, [x, y1, z1], [x, y1, z0]);
  push(arr, [x, y1, z0], [x, y0, z0]);
  for (let i = 1; i <= bars; i++) {
    const z = z0 + ((z1 - z0) * i) / (bars + 1);
    push(arr, [x, y0, z], [x, y1, z]);
  }
  if (midBar) push(arr, [x, (y0 + y1) / 2, z0], [x, (y0 + y1) / 2, z1]);
}

function cylinder(arr: Seg, cx: number, y0: number, cz: number, r: number, h: number) {
  const g = new CylinderGeometry(r, r, h, 16, 1, false);
  const e = new EdgesGeometry(g, 40); // rings only
  const pos = e.attributes.position.array as ArrayLike<number>;
  for (let i = 0; i < pos.length; i += 3) arr.push(pos[i] + cx, pos[i + 1] + y0 + h / 2, pos[i + 2] + cz);
  g.dispose();
  e.dispose();
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    push(arr, [x, y0, z], [x, y0 + h, z]);
  }
}

export type HouseWindow = { position: Vector3; yaw: number };

export function buildDhakaHouse() {
  const lot = ABOUT_LOT;
  const floors = ABOUT_FLOORS;
  const H = floors * FLOOR_HEIGHT;
  const hx = lot.depth / 2;
  const hz = lot.width / 2;
  const o = Math.sign(lot.facadeX);
  const fx = lot.facadeX;
  const colW = lot.width / ABOUT_COLS;
  const colZ = (c: number) => -hz + colW * (c + 0.5);

  const outline: Seg = [];
  const detail: Seg = [];
  const windows: Vector3[] = [];

  // Main volume and roof parapet.
  box(outline, 0, 0, 0, lot.depth, H, lot.width);
  const parapet = 1.0;
  for (const [x, z] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) push(outline, [x, H, z], [x, H + parapet, z]);
  push(outline, [-hx, H + parapet, -hz], [hx, H + parapet, -hz]);
  push(outline, [hx, H + parapet, -hz], [hx, H + parapet, hz]);
  push(outline, [hx, H + parapet, hz], [-hx, H + parapet, hz]);
  push(outline, [-hx, H + parapet, hz], [-hx, H + parapet, -hz]);

  // Floor slabs, with a small lip on the facade.
  for (let f = 1; f < floors; f++) {
    const y = f * FLOOR_HEIGHT;
    push(detail, [-hx, y, -hz], [hx, y, -hz]);
    push(detail, [hx, y, -hz], [hx, y, hz]);
    push(detail, [hx, y, hz], [-hx, y, hz]);
    push(detail, [-hx, y, hz], [-hx, y, -hz]);
    push(detail, [fx + o * 0.25, y, -hz], [fx + o * 0.25, y, hz]);
  }

  const gx = fx + o * 0.06; // grills sit just in front of the facade
  for (let f = 0; f < floors; f++) {
    const y = f * FLOOR_HEIGHT;
    if (f === 0) {
      // Ground floor: wide grilled gate (parking) and a small door.
      facadeRect(detail, gx, 0, 2.6, -hz + 0.5, colZ(1) + colW / 2 - 0.4, 14);
      facadeRect(detail, fx + o * 0.02, 0, 2.2, colZ(2) - 0.5, colZ(2) + 0.5);
      continue;
    }
    // Side columns: grilled windows.
    for (const c of [0, 2]) {
      const w = aboutWindowLocal(f, c);
      const y0 = w.y - ABOUT_WINDOW.height / 2;
      const y1 = w.y + ABOUT_WINDOW.height / 2;
      facadeRect(detail, fx + o * 0.02, y0, y1, w.z - ABOUT_WINDOW.width / 2, w.z + ABOUT_WINDOW.width / 2);
      facadeRect(detail, gx, y0, y1, w.z - ABOUT_WINDOW.width / 2, w.z + ABOUT_WINDOW.width / 2, 4, true);
      windows.push(w);
    }
    // Middle column: balcony with a grill railing and a door behind it.
    const zc = colZ(1);
    const bw = 3.0;
    const z0 = zc - bw / 2;
    const z1 = zc + bw / 2;
    const bx = fx + o * BALCONY_DEPTH;
    for (const yy of [y + 0.05, y + 1.05]) {
      push(detail, [fx, yy, z0], [bx, yy, z0]);
      push(detail, [bx, yy, z0], [bx, yy, z1]);
      push(detail, [bx, yy, z1], [fx, yy, z1]);
    }
    for (let z = z0; z <= z1 + 1e-6; z += 0.3) push(detail, [bx, y + 0.05, z], [bx, y + 1.05, z]);
    for (let d = 0.3; d < BALCONY_DEPTH; d += 0.3) {
      push(detail, [fx + o * d, y + 0.05, z0], [fx + o * d, y + 1.05, z0]);
      push(detail, [fx + o * d, y + 0.05, z1], [fx + o * d, y + 1.05, z1]);
    }
    facadeRect(detail, fx + o * 0.02, y + 0.05, y + 2.3, zc - 0.55, zc + 0.55);
    windows.push(new Vector3(fx, y + 1.2, zc));
  }

  // Roof: stair room at the back corner, water tanks on a stand.
  box(detail, -o * (hx - 2), H, hz - 2, 3, 2.6, 3.2);
  const tx = -o * (hx * 0.35);
  box(detail, tx, H, -hz * 0.35, 1.8, 0.5, 3.6);
  cylinder(detail, tx, H + 0.5, -hz * 0.35 - 0.9, 0.75, 1.3);
  cylinder(detail, tx, H + 0.5, -hz * 0.35 + 0.9, 0.75, 1.3);

  // World-space window slots (all but the one that stays on).
  const special = aboutWindowLocal(ABOUT_WINDOW.floor, ABOUT_WINDOW.col);
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  const yaw = Math.atan2(o * c, -o * s);
  const worldWindows: HouseWindow[] = windows
    .filter((w) => w.distanceTo(special) > 0.01)
    .map((w) => ({
      position: lotToWorld(lot, new Vector3(w.x + o * 0.04, w.y, w.z)),
      yaw,
    }));

  return {
    outline: new Float32Array(outline),
    detail: new Float32Array(detail),
    windows: worldWindows,
  };
}

let cached: ReturnType<typeof buildDhakaHouse> | null = null;
export const getDhakaHouse = () => (cached ??= buildDhakaHouse());
