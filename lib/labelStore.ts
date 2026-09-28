/**
 * DOM elements that live outside the canvas but are positioned from the 3D
 * scene each frame (projected anchor points). The scene writes transform,
 * opacity and text; React only renders them once.
 */
/** The About card attached to the lit window, and its leader line. */
export const aboutCardEls: {
  root: HTMLDivElement | null;
  codeRow: HTMLParagraphElement | null;
  code: HTMLSpanElement | null;
  cursor1: HTMLSpanElement | null;
  cursor2: HTMLSpanElement | null;
  label: HTMLParagraphElement | null;
  line1: HTMLParagraphElement | null;
  line2: HTMLParagraphElement | null;
  leader: SVGLineElement | null;
  /** Dark band under the leader, so city lines never cross it. */
  leaderPad: SVGLineElement | null;
  dot: SVGCircleElement | null;
  spark: SVGCircleElement | null;
} = {
  root: null,
  codeRow: null,
  code: null,
  cursor1: null,
  cursor2: null,
  label: null,
  line1: null,
  line2: null,
  leader: null,
  leaderPad: null,
  dot: null,
  spark: null,
};
