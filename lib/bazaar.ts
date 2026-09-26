import { PerspectiveCamera, Vector3 } from "three";
import { tools, type Tool } from "@/data/tools";
import { getCity, type Footprint } from "./city";
import { ROAD_LENGTH, roadCurve, roadFrame, sampleCamera } from "./paths";
import { ZONE_SECTION, sectionIndex } from "./sections";
import { ROOF_ROW, roofRowSlots } from "./roofRow";
import { BRIDGE_FROM, BRIDGE_TO, GANTRY_A } from "./bridge";

/*
 * The Neon Bazaar layout. Every sign is placed by a small solver so that,
 * seen from each Toolset hold at the actual viewport size:
 *   - the signs of that hold's zone are fully in frame, clear of the nav and
 *     the hold's title or caption,
 *   - at each hold, no sign of that hold's zone overlaps any other sign in
 *     front of it (a dimmed sign of another zone may stand hidden behind one),
 *   - every sign's inner edge stays SIGN_CLEARANCE from the road center.
 * Zone rules:
 *   Frontend street: shop boards alternating across both sides, like a market.
 *   Backend gali:    one row of tall signs on the right.
 *   Server roof:     one line along the rooftop edge on the left, one height.
 * Within a zone every sign has the same size and height and faces that
 * zone's hold camera. Along one side, same-size boards facing the camera can
 * only avoid overlapping if they are spaced evenly as seen from the hold,
 * which is what the solver does (the next sign goes just past the previous
 * one on screen, with a fixed gap).
 */

export const SIGN_CLEARANCE = 8.9;

export type SignLayout = "row" | "column";

export type SignSpec = {
  tool: Tool;
  zone: Tool["zone"];
  /** Board center in world space. */
  position: Vector3;
  /** Rotation about Y so the board faces its zone's hold camera. */
  yaw: number;
  width: number;
  height: number;
  layout: SignLayout;
  /** The zone's hold (section index), and the phase in it when the sign flickers on. */
  section: number;
  trigger: number;
  /** Extra structure lines (brackets, roof legs), world space pairs. */
  structure: number[];
  /** Where the pulse leaves the sign (top of the board). */
  anchor: Vector3;
  side: 1 | -1;
  a: number;
};

type Zone = Tool["zone"];

const BOARD: Record<Zone, { w: number; h: number; y: number }> = {
  frontend: { w: 2.7, h: 1.0, y: 3.2 },
  backend: { w: 1.2, h: 3.3, y: 6.4 },
  // y is the one line height for the whole roof row (board center).
  server: { w: 4.4, h: 1.4, y: 18.2 },
};

/** Frontend street shop boards: lower and upper floor rows (board centers, m). */
const FRONTEND_ROWS = [3.0,4.4,5.8,7.2];
/** Largest to smallest on-screen board height in the Frontend street. */
const MAX_SIZE_RATIO = 1.5;

/** Where each zone may start along the road, and which side(s) it uses. */
const ZONE_RULES: Record<Zone, { from: number; to: number; sides: (1 | -1)[] }> = {
  frontend: { from: 0.456, to: 0.512, sides: [-1, 1] },
  backend: { from: 0.512, to: 0.588, sides: [1] },
  server: { from: 0.55, to: 0.628, sides: [-1] },
};

const SEARCH_STEP = 0.0004;
/** Screen gaps, in CSS pixels. */
const GAP = 10;
const EDGE = 28;
const NAV_H = 76;

/** Screen areas taken by each hold's text (see Overlays LAYOUT), in px. */
function textRects(section: number, w: number, h: number): Rect[] {
  const nav: Rect = { x0: 0, y0: 0, x1: w, y1: NAV_H };
  const center = (width: number, y0: number, y1: number): Rect => ({
    x0: w / 2 - width / 2,
    y0,
    x1: w / 2 + width / 2,
    y1,
  });
  if (section === sectionIndex("toolset")) return [nav, center(560, 0.12 * h - 20, 0.12 * h + 175)];
  if (section === sectionIndex("gali")) return [nav, center(480, 0.12 * h - 20, 0.12 * h + 70)];
  if (section === sectionIndex("roof")) return [nav, center(480, h - 0.1 * h - 80, h - 0.1 * h + 10)];
  return [nav];
}

type Rect = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (p: Rect, q: Rect, gap = 0) =>
  p.x0 < q.x1 + gap && q.x0 < p.x1 + gap && p.y0 < q.y1 + gap && q.y0 < p.y1 + gap;

type Hold = { section: number; zone: Zone; cam: PerspectiveCamera; texts: Rect[] };

function holdCamera(section: number, aspect: number) {
  const pos = new Vector3();
  const look = new Vector3();
  sampleCamera(section, pos, look);
  const cam = new PerspectiveCamera(55, aspect, 2, 2000);
  cam.position.copy(pos);
  cam.lookAt(look);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

const tmp = new Vector3();
/** Screen rect of a board from a camera, or null if any corner is behind it. */
function project(cam: PerspectiveCamera, c: Vector3, yaw: number, bw: number, bh: number, w: number, h: number): Rect | null {
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const u of [-bw / 2, bw / 2]) {
    for (const v of [-bh / 2, bh / 2]) {
      tmp.set(c.x + u * cs, c.y + v, c.z - u * sn).project(cam);
      if (tmp.z > 1 || tmp.z < -1) return null;
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1 };
}

const facing = (pos: Vector3, cam: Vector3) => Math.atan2(cam.x - pos.x, cam.z - pos.z);

/** Board pose at road fraction a on a side: faces the camera, inner edge at SIGN_CLEARANCE. */
function pose(a: number, side: 1 | -1, y: number, bw: number, cam: Vector3) {
  const t = roadCurve.getTangentAt(a);
  const right = new Vector3(-t.z, 0, t.x);
  let lateral = SIGN_CLEARANCE + bw / 2;
  let position = roadFrame(a, side * lateral, y);
  let yaw = facing(position, cam);
  for (let i = 0; i < 3; i++) {
    const axis = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    lateral = SIGN_CLEARANCE + (bw / 2) * Math.abs(axis.dot(right)) + 0.05;
    position = roadFrame(a, side * lateral, y);
    yaw = facing(position, cam);
  }
  return { position, yaw };
}

/** The frontage building (if any) standing at road fraction a on a side. */
function frontageAt(a: number, side: 1 | -1): Footprint | undefined {
  return getCity().footprints.find(
    (f) => f.frontage && f.frontage.side === side && Math.abs(f.frontage.a - a) * ROAD_LENGTH < f.frontage.halfWidth - 0.6
  );
}

export function buildBazaar(width = 1440, height = 900): SignSpec[] {
  const aspect = width / Math.max(1, height);
  const holds: Hold[] = (Object.keys(ZONE_SECTION) as Zone[]).map((zone) => {
    const section = sectionIndex(ZONE_SECTION[zone]);
    return { section, zone, cam: holdCamera(section, aspect), texts: textRects(section, width, height) };
  });
  const holdOf = (zone: Zone) => holds.find((hd) => hd.zone === zone)!;

  type Placed = { spec: Omit<SignSpec, "trigger">; rects: (Rect | null)[] };
  const placed: Placed[] = [];

  // Server roof: one straight row on a rooftop edge (see roofRow.ts).
  {
    const roofTools = tools.filter((t) => t.zone === "server");
    const hold = holdOf("server");
    const slots = roofRowSlots(roofTools.length);
    roofTools.forEach((tool, k) => {
      const { position, yaw } = slots[k];
      const rects = holds.map((hd) => project(hd.cam, position, yaw, ROOF_ROW.w, ROOF_ROW.h, width, height));
      // Two legs down to the rooftop (or the ground) under each board.
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      const structure: number[] = [];
      for (const u of [-ROOF_ROW.w * 0.36, ROOF_ROW.w * 0.36]) {
        const x = position.x + u * c;
        const z = position.z - u * sn;
        const under = getCity().footprints.find((f) => {
          const dx = x - f.x;
          const dz = z - f.z;
          const cc = Math.cos(f.yaw);
          const ss = Math.sin(f.yaw);
          return Math.abs(dx * cc - dz * ss) < f.sx / 2 && Math.abs(dx * ss + dz * cc) < f.sz / 2;
        });
        structure.push(x, under ? under.roof : 0, z, x, ROOF_ROW.y - ROOF_ROW.h / 2, z);
      }
      // A rail joining the row along the rooftop edge.
      if (k > 0) {
        const p = slots[k - 1].position;
        structure.push(p.x, ROOF_ROW.y - ROOF_ROW.h / 2 - 0.3, p.z, position.x, ROOF_ROW.y - ROOF_ROW.h / 2 - 0.3, position.z);
      }
      placed.push({
        spec: {
          tool,
          zone: "server",
          position,
          yaw,
          width: ROOF_ROW.w,
          height: ROOF_ROW.h,
          layout: "row",
          section: hold.section,
          structure,
          anchor: position.clone().setY(ROOF_ROW.y + ROOF_ROW.h / 2),
          side: -1,
          a: ROOF_ROW.a,
        },
        rects,
      });
    });
  }

  for (const zone of ["frontend", "backend"] as Zone[]) {
    const b = BOARD[zone];
    const rule = ZONE_RULES[zone];
    const hold = holdOf(zone);
    const camPos = hold.cam.position;
    const zoneTools = tools.filter((t) => t.zone === zone);
    // Frontend street: two rows of shop boards (lower and upper floor).
    const rows = zone === "frontend" ? FRONTEND_ROWS : [b.y];
    const nextA = new Map<string, number>();
    const startA = (side: number, y: number) => nextA.get(`${side}:${y}`) ?? rule.from;
    // Frontend: keep every board's on-screen height within MAX_SIZE_RATIO.
    let minH = Infinity;
    let maxH = 0;
    const edge = zone === "frontend" ? width * 0.05 : EDGE;

    zoneTools.forEach((tool, i) => {
      // Preferred side alternates; if that side is full, try the other one.
      const preferred = rule.sides[i % rule.sides.length];
      const order = [preferred, ...rule.sides.filter((x) => x !== preferred)];
      for (const side of order)
      for (let a = Math.min(...rows.map((y) => startA(side, y))); a <= rule.to; a += SEARCH_STEP)
      for (const rowY of rows) {
        if (a < startA(side, rowY)) continue;
        // Server roof: needs a low-enough frontage roof under the board.
        let roof: Footprint | undefined;
        if (zone === "server") {
          roof = frontageAt(a, side);
          if (!roof || roof.roof > b.y - b.h / 2 - 1) continue;
        }
        const lateralMin = zone === "server" && roof ? roof.frontage!.facade + 0.6 : 0;
        let { position, yaw } = pose(a, side, rowY, b.w, camPos);
        if (lateralMin) {
          // Sit on the roof's road edge rather than out over the street.
          position = roadFrame(a, side * Math.max(lateralMin + b.w / 2, SIGN_CLEARANCE + b.w / 2), b.y);
          yaw = facing(position, camPos);
        }
        const rects = holds.map((hd) => project(hd.cam, position, yaw, b.w, b.h, width, height));
        const own = rects[holds.indexOf(hold)];
        if (!own) continue;
        // Fully in frame at its own hold, clear of the text there.
        if (own.x0 < edge || own.x1 > width - edge || own.y0 < NAV_H + 4 || own.y1 > height - EDGE) continue;
        const hPx = own.y1 - own.y0;
        if (zone === "frontend" && Math.max(maxH, hPx) / Math.min(minH, hPx) > MAX_SIZE_RATIO) continue;
        if (hold.texts.some((r) => overlaps(own, r, 8))) continue;
        // At each hold, the signs of that hold's zone overlap nothing:
        // here that means this sign clears every placed sign at its own hold,
        // and clears the focus zone's signs at the other holds.
        const clash = placed.some((p) =>
          holds.some((hd, k) => {
            const r = rects[k];
            const q = p.rects[k];
            if (!r || !q) return false;
            if (!overlaps(r, q, GAP)) return false;
            if (hd === hold) return true; // at its own hold: never overlap anything
            if (p.spec.zone !== hd.zone) return false; // two dimmed signs: fine
            // At another zone's hold, only allowed if this sign stands behind the
            // focus sign (farther from that camera): its dark backing hides it.
            return position.distanceTo(hd.cam.position) <= p.spec.position.distanceTo(hd.cam.position);
          })
        );
        if (clash) continue;
        // Also clear of the other holds' text where this sign is visible there.
        const textClash = holds.some(
          (hd, k) => hd !== hold && rects[k] && inFrame(rects[k]!, width, height) && hd.texts.some((r) => overlaps(rects[k]!, r, 4))
        );
        if (textClash) continue;

        const top = position.clone().setY(rowY + b.h / 2);
        const structure: number[] = [];
        if (zone === "server" && roof) {
          const c = Math.cos(yaw);
          const s = Math.sin(yaw);
          for (const u of [-b.w * 0.35, b.w * 0.35]) {
            const x = position.x + u * c;
            const z = position.z - u * s;
            structure.push(x, roof.roof, z, x, rowY - b.h / 2, z);
          }
        } else {
          // Bracket from the top of the board back to the facade behind it.
          const fp = frontageAt(a, side);
          const facade = roadFrame(a, side * (fp ? fp.frontage!.facade : SIGN_CLEARANCE + b.w + 0.5), rowY + b.h / 2);
          structure.push(top.x, top.y, top.z, facade.x, facade.y, facade.z);
        }
        placed.push({
          spec: {
            tool,
            zone,
            position,
            yaw,
            width: b.w,
            height: b.h,
            layout: zone === "backend" ? "column" : "row",
            section: hold.section,
            structure,
            anchor: top,
            side,
            a,
          },
          rects,
        });
        nextA.set(`${side}:${rowY}`, a + SEARCH_STEP);
        minH = Math.min(minH, hPx);
        maxH = Math.max(maxH, hPx);
        return;
      }
      if (process.env.NODE_ENV !== "production") console.warn(`[bazaar] no room for ${tool.name} in ${zone}`);
    });
  }

  // Each zone lights in its own hold, nearest sign first.
  return placed.map(({ spec }) => {
    const zc = holdOf(spec.zone).cam.position;
    const inZone = placed
      .map((p) => p.spec)
      .filter((q) => q.zone === spec.zone)
      .sort((p, q) => p.position.distanceTo(zc) - q.position.distanceTo(zc));
    const n = Math.max(1, inZone.length - 1);
    return { ...spec, trigger: -0.3 + 0.6 * (inZone.indexOf(spec) / n) };
  });
}

const inFrame = (r: Rect, w: number, h: number) => r.x1 > 0 && r.x0 < w && r.y1 > 0 && r.y0 < h;

// Cached per viewport size (rounded), since the layout is solved on screen.
const cache = new Map<string, SignSpec[]>();
export function getBazaar(width = 1440, height = 900) {
  const key = `${Math.round(width / 40)}x${Math.round(height / 40)}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = buildBazaar(width, height);
    cache.set(key, hit);
  }
  return hit;
}

/* ---------------- Neon cable beside the road ---------------- */

export const CABLE = { lateral: -9.2, from: 0.43, to: BRIDGE_TO - 0.006, height: 7.2, bridgeHeight: 11, sag: 0.55, span: 14 };

/** Cable height: street height through the bazaar, above the billboards on the bridge. */
const cableHeight = (a: number) => {
  const t = Math.min(1, Math.max(0, (a - (GANTRY_A - 0.012)) / (BRIDGE_FROM - GANTRY_A + 0.012)));
  return CABLE.height + (CABLE.bridgeHeight - CABLE.height) * t * t * (3 - 2 * t);
};

/** Overhead cable along the left side of the road to the end of the bridge, sagging between poles. */
export function buildCable() {
  const pts: Vector3[] = [];
  const poles: Vector3[] = [];
  const length = (CABLE.to - CABLE.from) * ROAD_LENGTH;
  const spans = Math.max(1, Math.round(length / CABLE.span));
  const per = 10;
  for (let i = 0; i <= spans; i++) {
    const a = CABLE.from + ((CABLE.to - CABLE.from) * i) / spans;
    poles.push(roadFrame(a, CABLE.lateral, cableHeight(a)));
    if (i === spans) break;
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const aa = a + ((CABLE.to - CABLE.from) / spans) * t;
      pts.push(roadFrame(aa, CABLE.lateral, cableHeight(aa) - CABLE.sag * 4 * t * (1 - t)));
    }
  }
  pts.push(roadFrame(CABLE.to, CABLE.lateral, cableHeight(CABLE.to)));
  return { points: pts, poles };
}
