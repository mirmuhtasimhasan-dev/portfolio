/** Street name plates of the three tech-stack zones (drawn by TechGate). */
import { Vector3 } from "three";
import { facingPose } from "./bridge";
import { sampleCamera } from "./paths";
import { roadCurve } from "./road";
import { sectionIndex } from "./sections";

export type PlateSpec = { section: number; title: string; note: string; a: number; side: 1 | -1; y: number };
export const PLATE = { w: 4.2, h: 1.4 };

/*
 * One plate per zone on a pole at the roadside, ahead of that zone's hold and
 * facing its camera, inner edge 8.9 m from the road center. Same style for all
 * three; lit while its hold is active. Distance, side and height are chosen so
 * that at the hold the plate is fully on screen (1280x800 to 2560x1440) and
 * clear of every sign, the nav and the click hint at the bottom.
 */
export const PLATES: (PlateSpec & { position: Vector3; yaw: number })[] = (
  [
    { section: sectionIndex("toolset"), title: "Frontend", note: "What users see", ahead: 18, side: 1, y: 1.0 },
    { section: sectionIndex("gali"), title: "Backend & Data", note: "What runs behind it", ahead: 18, side: -1, y: 2.1 },
    { section: sectionIndex("roof"), title: "Deploy & DevOps", note: "Where it goes live", ahead: 13, side: -1, y: 3.0 },
  ] as const
).map((p) => {
  const cam = new Vector3();
  const look = new Vector3();
  sampleCamera(p.section, cam, look);
  // Road fraction of the hold camera, then a little ahead of it.
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i <= 2000; i++) {
    const q = roadCurve.getPointAt(i / 2000);
    const d = (q.x - cam.x) ** 2 + (q.z - cam.z) ** 2;
    if (d < bd) {
      bd = d;
      best = i / 2000;
    }
  }
  const a = best + p.ahead / roadCurve.getLength();
  const side = p.side as 1 | -1;
  return { section: p.section, title: p.title, note: p.note, a, side, y: p.y, ...facingPose(a, side, p.y, PLATE.w, cam) };
});