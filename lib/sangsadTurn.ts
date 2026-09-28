/**
 * Drag-to-turn state for Sangsad Bhaban at the Contact hold. The building
 * component writes it from pointer events and damps its yaw toward `target`
 * each frame; the hint element fades out after the first drag.
 */
export const MAX_TURN = (60 * Math.PI) / 180;

export const sangsadTurn = {
  /** Current (damped) extra yaw, radians. */
  angle: 0,
  /** Where the building is being turned to (0 = front view). */
  target: 0,
  dragging: false,
  /** True once the visitor has turned it once (hides the hint). */
  dragged: false,
  hint: null as HTMLDivElement | null,
};
