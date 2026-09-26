/**
 * DOM elements that live outside the canvas but are positioned from the 3D
 * scene each frame (projected anchor points). The scene writes transform,
 * opacity and text; React only renders them once.
 */
export const credentialLabelEls: (HTMLDivElement | null)[] = [];

/** The screen card beside the About window: root and the typed code. */
export const aboutScreenEls: { root: HTMLDivElement | null; code: HTMLSpanElement | null } = {
  root: null,
  code: null,
};
