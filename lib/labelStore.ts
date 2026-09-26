/**
 * DOM elements that live outside the canvas but are positioned from the 3D
 * scene each frame (projected anchor points). The scene writes transform,
 * opacity and text; React only renders them once.
 */
export const credentialLabelEls: (HTMLDivElement | null)[] = [];

/** The About card attached to the lit window, and its leader line. */
export const aboutCardEls: {
  root: HTMLDivElement | null;
  code: HTMLSpanElement | null;
  label: HTMLParagraphElement | null;
  line1: HTMLParagraphElement | null;
  line2: HTMLParagraphElement | null;
  leader: SVGLineElement | null;
  dot: SVGCircleElement | null;
} = { root: null, code: null, label: null, line1: null, line2: null, leader: null, dot: null };

/** "Used in" tooltip for the hovered or selected Neon Bazaar sign. */
export const toolTipEls: { root: HTMLDivElement | null; name: HTMLParagraphElement | null; used: HTMLParagraphElement | null } = {
  root: null,
  name: null,
  used: null,
};
