import { Vector3 } from "three";
import { ROAD_HALF_WIDTH, ROAD_LENGTH, roadCurve } from "./paths";

/** Facades start at ROAD_HALF_WIDTH + SIDEWALK = 9 m from the road center. */
export const SIDEWALK = 4;
export const FLOOR_HEIGHT = 3.2;

/*
 * Buildings that carry section content. They are the only buildings drawn in
 * bright green. The city generator leaves their lots empty.
 *
 * Local frame (group rotated by `yaw`): +Z runs along the road, the facade
 * facing the road is at x = facadeX, and `side` (+1 right, -1 left) points
 * away from the road.
 */
export type ContentLot = {
  id: "about" | "credentials";
  /** Arc fraction of the lot center along the road. */
  a: number;
  side: 1 | -1;
  /** Along the road. */
  width: number;
  /** Away from the road. */
  depth: number;
  floors: number;
  position: Vector3;
  yaw: number;
  /** Local x of the facade facing the road. */
  facadeX: number;
  /** Extra distance of the facade behind the sidewalk line. */
  setback: number;
  /** Highest point including roof structures (for clearance checks). */
  top: number;
  /** Arc range the lot occupies (with a small gap), for the generator. */
  aFrom: number;
  aTo: number;
};

function makeLot(
  id: ContentLot["id"],
  a: number,
  side: 1 | -1,
  width: number,
  depth: number,
  floors: number,
  { setback = 0, top = floors * FLOOR_HEIGHT }: { setback?: number; top?: number } = {}
): ContentLot {
  const p = roadCurve.getPointAt(a);
  const t = roadCurve.getTangentAt(a);
  const right = new Vector3(-t.z, 0, t.x);
  const off = ROAD_HALF_WIDTH + SIDEWALK + setback + depth / 2;
  const position = p.addScaledVector(right, off * side).setY(0);
  const half = (width / 2 + 1.2) / ROAD_LENGTH;
  return {
    id,
    a,
    side,
    width,
    depth,
    floors,
    position,
    yaw: Math.atan2(t.x, t.z),
    // Local +X maps to -right, so the road-facing facade is on the +side for
    // right-hand lots and the -side for left-hand lots.
    facadeX: (side * depth) / 2,
    setback,
    top,
    aFrom: a - half,
    aTo: a + half,
  };
}

/** How far About balconies stick out from the facade. */
export const BALCONY_DEPTH = 1.2;
export const ABOUT_FLOORS = 7;

// About: a Mohammadpur house on the right, just ahead of the stop. Set back so
// its balconies stay behind the sidewalk line.
export const ABOUT_LOT = makeLot("about", 0.214, 1, 13, 14, ABOUT_FLOORS, {
  setback: BALCONY_DEPTH + 0.4,
  top: ABOUT_FLOORS * FLOOR_HEIGHT + 3.2,
});

/** Credentials: foundation plus one floor per credential. */
export const FOUNDATION_HEIGHT = 0.6;
export const CREDENTIAL_FLOOR_COUNT = 3;
export const CREDENTIALS_LOT = makeLot("credentials", 0.326, -1, 15, 14, CREDENTIAL_FLOOR_COUNT, {
  top: FOUNDATION_HEIGHT + CREDENTIAL_FLOOR_COUNT * FLOOR_HEIGHT,
});
export const credentialFloorBase = (k: number) => FOUNDATION_HEIGHT + k * FLOOR_HEIGHT;

export const CONTENT_LOTS = [ABOUT_LOT, CREDENTIALS_LOT];

/** The About window that stays on: floor 2, the column nearest the approaching camera. */
export const ABOUT_WINDOW = {
  floor: 2,
  col: 0,
  width: 1.8,
  height: 1.5,
};
export const ABOUT_COLS = 3;
export const aboutWindowLocal = (floor: number, col: number) => {
  const lot = ABOUT_LOT;
  const colW = lot.width / ABOUT_COLS;
  return new Vector3(
    lot.facadeX,
    floor * FLOOR_HEIGHT + 0.9 + ABOUT_WINDOW.height / 2,
    -lot.width / 2 + colW * (col + 0.5)
  );
};

/** Lot-local point to world space. */
export function lotToWorld(lot: ContentLot, local: Vector3, out = new Vector3()) {
  const c = Math.cos(lot.yaw);
  const s = Math.sin(lot.yaw);
  return out.set(
    lot.position.x + local.x * c + local.z * s,
    local.y,
    lot.position.z - local.x * s + local.z * c
  );
}
