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
  floors: number
): ContentLot {
  const p = roadCurve.getPointAt(a);
  const t = roadCurve.getTangentAt(a);
  const right = new Vector3(-t.z, 0, t.x);
  const off = ROAD_HALF_WIDTH + SIDEWALK + depth / 2;
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
    aFrom: a - half,
    aTo: a + half,
  };
}

// About: Mohammadpur residential block on the right, just ahead of the stop.
export const ABOUT_LOT = makeLot("about", 0.214, 1, 13, 14, 8);
// Credentials: the next building, on the left.
export const CREDENTIALS_LOT = makeLot("credentials", 0.326, -1, 15, 14, 9);

export const CONTENT_LOTS = [ABOUT_LOT, CREDENTIALS_LOT];

/** Which floors light up for credentials, bottom to top. */
export const CREDENTIAL_FLOORS = [1, 2, 3];
