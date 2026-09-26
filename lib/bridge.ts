import { Vector3 } from "three";
import { projects, type Project } from "@/data/projects";
import { ROAD_LENGTH, roadCurve, roadFrame } from "./road";

/*
 * Hatirjheel: an overhead gantry sign before a curved bridge over water.
 * Featured projects (max 5) get billboards along the bridge, alternating
 * right and left, one camera hold each. The bridge (and the water, and the
 * camera path) grow with the number of featured projects.
 */

export const MAX_BILLBOARDS = 5;
export const FEATURED: Project[] = projects.filter((p) => p.featured).slice(0, MAX_BILLBOARDS);

/** Road fractions. */
export const GANTRY_A = 0.632;
export const BRIDGE_FROM = 0.645;
const FIRST_BILLBOARD_A = 0.678;
const BILLBOARD_SPACING = 0.05;
/** How far before its billboard each hold camera stands (road fraction). */
export const HOLD_BACK = 0.021;

const count = Math.max(1, FEATURED.length);
export const BRIDGE_TO = FIRST_BILLBOARD_A + (count - 1) * BILLBOARD_SPACING + 0.038;
/** Water under and around the bridge, a little past both ends. */
export const WATER = { from: BRIDGE_FROM - 0.012, to: BRIDGE_TO + 0.014, halfWidth: 70, y: -2.2 };

/** Deck edge, railing and billboard clearance, metres from the road center. */
export const DECK_HALF = 9.2;
export const RAIL_H = 1.1;
export const SIGN_CLEARANCE = 8.9;

/** Hold camera height on the bridge and at the gantry. */
export const BRIDGE_EYE = 4.6;
export const GANTRY_EYE = 4.2;

export const BILLBOARD = { w: 7.6, h: 4.75, y: 5.9, strip: 0.8 };

export type BillboardSpec = {
  project: Project;
  index: number;
  a: number;
  side: 1 | -1;
  position: Vector3;
  yaw: number;
  /** Where this billboard's hold camera stands. */
  hold: Vector3;
  holdA: number;
  /** Top center of the frame (the pulse lands here). */
  anchor: Vector3;
};

const facing = (pos: Vector3, cam: Vector3) => Math.atan2(cam.x - pos.x, cam.z - pos.z);

/** Board center at road fraction a: faces the camera, inner edge at SIGN_CLEARANCE. */
export function facingPose(a: number, side: 1 | -1, y: number, bw: number, cam: Vector3) {
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

export const BILLBOARDS: BillboardSpec[] = FEATURED.map((project, index) => {
  const a = FIRST_BILLBOARD_A + index * BILLBOARD_SPACING;
  const side = (index % 2 === 0 ? 1 : -1) as 1 | -1;
  const holdA = a - HOLD_BACK;
  const hold = roadFrame(holdA, 0, BRIDGE_EYE);
  const { position, yaw } = facingPose(a, side, BILLBOARD.y, BILLBOARD.w, hold);
  return {
    project,
    index,
    a,
    side,
    position,
    yaw,
    hold,
    holdA,
    anchor: position.clone().setY(BILLBOARD.y + BILLBOARD.h / 2),
  };
});

/** "All projects" neon sign at the end of the bridge, facing the last hold. */
export const ALL_PROJECTS_SIGN = (() => {
  const last = BILLBOARDS[BILLBOARDS.length - 1];
  const a = BRIDGE_TO - 0.01;
  const side = (last ? -last.side : 1) as 1 | -1;
  const cam = last ? last.hold : roadFrame(a - 0.03, 0, BRIDGE_EYE);
  return { a, side, w: 3.4, h: 0.9, ...facingPose(a, side, 2.4, 3.4, cam) };
})();

/** Along-road metres between two road fractions. */
export const roadMetres = (from: number, to: number) => (to - from) * ROAD_LENGTH;
