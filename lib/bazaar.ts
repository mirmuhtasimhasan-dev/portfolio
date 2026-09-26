import { Vector3 } from "three";
import { tools, type Tool } from "@/data/tools";
import { projects } from "@/data/projects";
import { getCity, type Footprint } from "./city";
import { ROAD_LENGTH, roadFrame, sampleCamera } from "./paths";
import { ZONE_SECTION, sectionIndex } from "./sections";

/*
 * The Neon Bazaar: where each tool's sign hangs along the street ahead of
 * the Toolset stop. Signs are mounted on real frontage buildings (from the
 * generator's footprints), face the Toolset camera so they read down the
 * street, and never come closer than SIGN_CLEARANCE to the road center.
 */

export const SIGN_CLEARANCE = 8.7;

export type SignLayout = "row" | "column";

export type SignSpec = {
  tool: Tool;
  zone: Tool["zone"];
  /** Board center in world space. */
  position: Vector3;
  /** Rotation about Y so the board faces the Toolset camera. */
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

// Where each zone starts along the road (arc fraction). The Toolset camera
// stands at 0.42 looking down the street.
const FRONTEND_FROM = 0.449;
// Rooftop boards: on the roofs past the gali, where the Server roof hold can
// look up at them at a moderate angle (board tops within ROOF_MAX_ELEVATION).
const ROOF_FROM = 0.515;
const ROOF_TO = 0.575;
const ROOF_MAX_ELEVATION = (24 * Math.PI) / 180;

const BOARD = {
  frontend: { w: 3.6, h: 1.3, y: 3.8 },
  backend: { w: 1.3, h: 3.6, y: 5.2 },
  server: { w: 5, h: 1.6 },
};
// Boards on the same side step up and down so they never overlap on screen.
const STAGGER = {
  frontend: 1.75,
  backend: 0.9,
};

type Slot = { fp: Footprint; a: number };

function frontageSlots(from: number): Slot[] {
  const slots: Slot[] = [];
  for (const fp of getCity().footprints) {
    const f = fp.frontage;
    if (!f || f.a < from - 0.02) continue;
    // Two slots per building, a quarter of its width either side of center.
    const d = (f.halfWidth * 0.5) / ROAD_LENGTH;
    for (const a of [f.a - d, f.a + d]) if (a >= from) slots.push({ fp, a });
  }
  return slots.sort((p, q) => p.a - q.a);
}

function facing(pos: Vector3, cam: Vector3) {
  return Math.atan2(cam.x - pos.x, cam.z - pos.z);
}

/** Camera position at a zone's hold: signs in that zone face it. */
function zoneCamera(zone: Tool["zone"]) {
  const cam = new Vector3();
  const look = new Vector3();
  sampleCamera(sectionIndex(ZONE_SECTION[zone]), cam, look);
  return cam;
}

export function buildBazaar(): SignSpec[] {

  const specs: Omit<SignSpec, "trigger" | "section">[] = [];
  const slots = frontageSlots(FRONTEND_FROM);
  let cursor = 0;
  const perSide = { [1]: 0, [-1]: 0 } as Record<1 | -1, number>;

  // Frontend street and Backend gali: hanging boards on the facades.
  for (const zone of ["frontend", "backend"] as const) {
    const b = BOARD[zone];
    for (const tool of tools.filter((t) => t.zone === zone)) {
      const slot = slots[cursor++];
      if (!slot) break;
      const side = slot.fp.frontage!.side;
      const y = b.y + (perSide[side]++ % 2) * STAGGER[zone];
      // Inner edge at SIGN_CLEARANCE; the board reaches back toward the wall.
      const lateral = side * (SIGN_CLEARANCE + b.w / 2);
      const position = roadFrame(slot.a, lateral, y);
      const yaw = facing(position, zoneCamera(zone));
      const facade = roadFrame(slot.a, side * slot.fp.frontage!.facade, y + b.h / 2);
      const top = position.clone().setY(y + b.h / 2);
      const structure = [top.x, top.y, top.z, facade.x, facade.y, facade.z];
      specs.push({
        tool,
        zone,
        position,
        yaw,
        width: b.w,
        height: b.h,
        layout: zone === "frontend" ? "row" : "column",
        structure,
        anchor: top,
        side,
        a: slot.a,
      });
    }
  }

  // Server roof: boards on rooftop frames over the gali, nearest that fit in frame.
  const roofTools = tools.filter((t) => t.zone === "server");
  const used = new Set<Footprint>();
  const topOfBoard = (fp: Footprint) => fp.roof + 1.2 + BOARD.server.h;
  const roofCam = zoneCamera("server");
  const roofs = getCity()
    .footprints.filter((fp) => {
      const f = fp.frontage;
      if (!f || f.a < ROOF_FROM || f.a > ROOF_TO) return false;
      const p = roadFrame(f.a, f.side * f.facade, 0);
      const dist = Math.hypot(p.x - roofCam.x, p.z - roofCam.z);
      return Math.atan2(topOfBoard(fp) - roofCam.y, dist) <= ROOF_MAX_ELEVATION;
    })
    .sort((p, q) => p.frontage!.a - q.frontage!.a);
  let wantSide: 1 | -1 = roofs[0]?.frontage?.side ?? 1;
  const roofsPerSide = { [1]: 0, [-1]: 0 } as Record<1 | -1, number>;
  for (const tool of roofTools) {
    const fp =
      roofs.find((r) => !used.has(r) && r.frontage!.side === wantSide) ?? roofs.find((r) => !used.has(r));
    if (!fp) break;
    used.add(fp);
    wantSide = (fp.frontage!.side * -1) as 1 | -1;
    const f = fp.frontage!;
    const b = BOARD.server;
    // A farther board on the same side stands taller and further back on its
    // roof, so it shows above and outside the nearer one (and the title).
    const k = roofsPerSide[f.side]++;
    const legH = 1.2 + 2.6 * k;
    const y = fp.roof + legH + b.h / 2;
    const lateral = f.side * Math.max(SIGN_CLEARANCE + b.w / 2, f.facade + 2.4 + 7 * k);
    const position = roadFrame(f.a, lateral, y);
    const yaw = facing(position, zoneCamera("server"));
    // Two legs from the roof to the board's bottom corners.
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const structure: number[] = [];
    for (const u of [-b.w * 0.35, b.w * 0.35]) {
      const x = position.x + u * c;
      const z = position.z - u * s;
      structure.push(x, fp.roof, z, x, y - b.h / 2, z);
    }
    specs.push({
      tool,
      zone: "server",
      position,
      yaw,
      width: b.w,
      height: b.h,
      layout: "row",
      structure,
      anchor: position.clone().setY(y + b.h / 2),
      side: f.side,
      a: f.a,
    });
  }

  // Each zone lights in its own hold, nearest sign first.
  return specs.map((sp) => {
    const zc = zoneCamera(sp.zone);
    const inZone = specs
      .filter((q) => q.zone === sp.zone)
      .sort((p, q) => p.position.distanceTo(zc) - q.position.distanceTo(zc));
    const n = Math.max(1, inZone.length - 1);
    return {
      ...sp,
      section: sectionIndex(ZONE_SECTION[sp.zone]),
      trigger: -0.3 + 0.6 * (inZone.indexOf(sp) / n),
    };
  });
}

let cached: SignSpec[] | null = null;
export const getBazaar = () => (cached ??= buildBazaar());

/* ---------------- Projects billboards (placeholders until Phase 4) ---------------- */

export type BillboardSpec = { slug: string; name: string; year: number; position: Vector3; yaw: number };

export const BILLBOARD = { w: 6, h: 3.4, bottom: 9.4 };
export const MAX_BILLBOARDS = 5;

export function buildBillboards(): BillboardSpec[] {
  const cam = new Vector3();
  const look = new Vector3();
  sampleCamera(sectionIndex("projects"), cam, look);
  return projects
    .filter((p) => p.featured)
    .slice(0, MAX_BILLBOARDS)
    .map((p, i) => {
      // Alternating right and left, spaced along the road ahead of the stop.
      const side = i % 2 === 0 ? 1 : -1;
      const a = 0.652 + i * 0.03;
      const position = roadFrame(a, side * (SIGN_CLEARANCE + BILLBOARD.w / 2), BILLBOARD.bottom + BILLBOARD.h / 2);
      return { slug: p.slug, name: p.name, year: p.year, position, yaw: facing(position, cam) };
    });
}

/* ---------------- Neon cable beside the road ---------------- */

export const CABLE = { lateral: -9.2, from: 0.43, to: 0.715, height: 7.2, sag: 0.55, span: 14 };

/** Overhead cable along the left side of the road, sagging between poles. */
export function buildCable() {
  const pts: Vector3[] = [];
  const poles: Vector3[] = [];
  const length = (CABLE.to - CABLE.from) * ROAD_LENGTH;
  const spans = Math.max(1, Math.round(length / CABLE.span));
  const per = 10;
  for (let i = 0; i <= spans; i++) {
    const a = CABLE.from + ((CABLE.to - CABLE.from) * i) / spans;
    poles.push(roadFrame(a, CABLE.lateral, 0));
    if (i === spans) break;
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const aa = a + ((CABLE.to - CABLE.from) / spans) * t;
      pts.push(roadFrame(aa, CABLE.lateral, CABLE.height - CABLE.sag * 4 * t * (1 - t)));
    }
  }
  pts.push(roadFrame(CABLE.to, CABLE.lateral, CABLE.height));
  return { points: pts, poles };
}
