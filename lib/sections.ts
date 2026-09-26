// Section order = camera stop order. The camera path is built from these ids.
// weight = share of the scroll track. About and Credentials play scroll-driven
// sequences in their holds, and the Toolset has one hold per zone (Frontend
// street, Backend gali, Server roof) so every sign can be read. Extra weight
// makes the page longer (TRACK_VH), it never shortens the other sections.
// num = the number shown in the section eyebrow (zones share the Toolset's).
export const SECTIONS = [
  { id: "hero", label: "Hero", weight: 1, num: 1 },
  { id: "about", label: "About", weight: 1.8, num: 2 },
  { id: "credentials", label: "Credentials", weight: 1.8, num: 3 },
  { id: "toolset", label: "Toolset: Frontend street", weight: 1.1, num: 4 },
  { id: "gali", label: "Toolset: Backend gali", weight: 1.1, num: 4 },
  { id: "roof", label: "Toolset: Server roof", weight: 1.1, num: 4 },
  { id: "projects", label: "Projects", weight: 1, num: 5 },
  { id: "contact", label: "Contact", weight: 1, num: 6 },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
export const SECTION_COUNT = SECTIONS.length;
export const sectionIndex = (id: SectionId) => SECTIONS.findIndex((s) => s.id === id);

/** The three Neon Bazaar holds, in street order, by tool zone. */
export const ZONE_SECTION = { frontend: "toolset", backend: "gali", server: "roof" } as const;

/** The tall container that produces master scroll progress. */
export const TRACK_ID = "scroll-track";

/** Scroll per unit of weight: the original 900vh for weights summing to 7.6. */
const VH_PER_WEIGHT = 900 / 7.6;
export const TRACK_VH = Math.round(VH_PER_WEIGHT * SECTIONS.reduce((a, s) => a + s.weight, 0));
