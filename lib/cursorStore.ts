import type { Object3D } from "three";

/*
 * Shared state for the custom desktop cursor (components/Cursor.tsx).
 *
 * 3D hover handlers call lockCursor(object, label) on pointer over and
 * unlockCursor(object) on pointer out; CursorProbe (inside the canvas)
 * projects the locked object's bounds to the screen every frame and writes
 * `rect`. The cursor reads `rect` in its own animation loop.
 */
export type ScreenRect = { x0: number; y0: number; x1: number; y1: number };

export const cursorStore = {
  /** The hovered 3D object and the label to show ("" for none). */
  target: null as { object: Object3D; label: string } | null,
  /** Its screen rectangle (CSS px), or null when nothing is locked. */
  rect: null as ScreenRect | null,
  /** Bumped on every change, so the cursor loop wakes up. */
  version: 0,
};

export function lockCursor(object: Object3D, label: string) {
  cursorStore.target = { object, label };
  cursorStore.version++;
}

export function unlockCursor(object: Object3D) {
  if (cursorStore.target?.object !== object) return;
  cursorStore.target = null;
  cursorStore.rect = null;
  cursorStore.version++;
}
