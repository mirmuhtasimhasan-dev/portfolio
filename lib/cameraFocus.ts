import { Vector3 } from "three";
import { ABOUT_LOT, ABOUT_WINDOW, aboutWindowLocal, lotToWorld } from "./contentBuildings";
import { sampleCamera } from "./paths";
import { sectionIndex } from "./sections";
import { aboutPhase, aboutPush } from "./timeline";

/*
 * Scroll-driven focus offsets added to the sampled camera target before
 * damping. Still a pure function of progress: the camera only moves when the
 * scroll does, and scrolling back reverses it.
 */

/** How far the camera eases toward the last lit window in About (metres). */
export const ABOUT_PUSH_DISTANCE = 3;
/** How much the look target turns toward the window at full push. */
const ABOUT_LOOK_BLEND = 0.5;

export const ABOUT_WINDOW_WORLD = lotToWorld(
  ABOUT_LOT,
  aboutWindowLocal(ABOUT_WINDOW.floor, ABOUT_WINDOW.col)
);

const aboutDir = (() => {
  const pos = new Vector3();
  const look = new Vector3();
  sampleCamera(sectionIndex("about"), pos, look);
  return ABOUT_WINDOW_WORLD.clone().sub(pos).normalize();
})();

export function applyFocus(progress: number, pos: Vector3, look: Vector3) {
  const k = aboutPush(aboutPhase(progress));
  if (k <= 0) return;
  pos.addScaledVector(aboutDir, ABOUT_PUSH_DISTANCE * k);
  look.lerp(ABOUT_WINDOW_WORLD, ABOUT_LOOK_BLEND * k);
}
