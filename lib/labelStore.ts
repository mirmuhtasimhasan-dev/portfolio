/**
 * DOM label elements that live outside the canvas but are positioned from the
 * 3D scene each frame (projected anchor points). The scene writes transform
 * and opacity; React only renders them once.
 */
export const credentialLabelEls: (HTMLDivElement | null)[] = [];
