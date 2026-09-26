/**
 * Shared, non-React state for the Neon Bazaar. Written by pointer events and
 * the pulse; read every frame by signs, billboards and the tooltip.
 */
export const bazaarStore = {
  /** Tool under the pointer. */
  hovered: null as string | null,
  /** Last clicked tool. */
  selected: null as string | null,
  /** Set when a sign is clicked; the pulse component consumes it. */
  pulseRequest: null as { tool: string; at: number } | null,
  /** Billboards lit by the current pulse: slug -> time (s) the pulse reached it. */
  lit: {} as Record<string, number>,
};
