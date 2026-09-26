/**
 * Which billboard is hovered, and which project's detail panel is open.
 * Written by the scene's pointer events, read by the billboards (every frame)
 * and by the ProjectPanel (subscribed).
 */
let open: string | null = null;
const listeners = new Set<() => void>();

export const projectStore = {
  hovered: null as string | null,
  getOpen: () => open,
  setOpen(slug: string | null) {
    if (slug === open) return;
    open = slug;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
