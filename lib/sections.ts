import { FEATURED } from "./bridge";

// Section order = camera stop order. The camera path is built from these ids.
// weight = share of the scroll track. About and Credentials play scroll-driven
// sequences in their holds, and the Toolset has one hold per zone (Frontend
// street, Backend gali, Server roof) so every sign can be read. Extra weight
// makes the page longer (TRACK_VH), it never shortens the other sections.
// num = the number shown in the section eyebrow (zones share the Toolset's).
// Projects: the gantry hold, then one hold per featured billboard (from
// data/projects.ts), so the page and the camera path grow with the count.
export type Section = { id: string; label: string; weight: number; num: number };

export const projectSectionId = (slug: string) => `project-${slug}`;

export const SECTIONS: Section[] = [
  { id: "hero", label: "Hero", weight: 1, num: 1 },
  { id: "about", label: "About", weight: 1.8, num: 2 },
  { id: "credentials", label: "Credentials", weight: 1.8, num: 3 },
  { id: "toolset", label: "Tech stack: Frontend", weight: 1.1, num: 4 },
  { id: "gali", label: "Tech stack: Backend & Data", weight: 1.1, num: 4 },
  { id: "roof", label: "Tech stack: Deploy & DevOps", weight: 1.1, num: 4 },
  { id: "projects", label: "Projects", weight: 1, num: 5 },
  ...FEATURED.map((p) => ({ id: projectSectionId(p.slug), label: `Projects: ${p.name}`, weight: 1, num: 5 })),
  // Contact plays the sunrise in its hold, then the form: more scroll.
  { id: "contact", label: "Contact", weight: 1.6, num: 6 },
];

export type SectionId = string;
export const SECTION_COUNT = SECTIONS.length;
export const sectionIndex = (id: SectionId) => {
  const i = SECTIONS.findIndex((s) => s.id === id);
  if (i < 0) throw new Error(`Unknown section "${id}"`);
  return i;
};
/** Section indices of the Projects gantry and every billboard hold. */
export const PROJECT_SECTIONS = SECTIONS.map((s, i) => (s.id === "projects" || s.id.startsWith("project-") ? i : -1)).filter((i) => i >= 0);

/** The three Neon Bazaar holds, in street order, by tool zone. */
export const ZONE_SECTION = { frontend: "toolset", backend: "gali", server: "roof" } as const;

/** The tall container that produces master scroll progress. */
export const TRACK_ID = "scroll-track";

/** Scroll per unit of weight: the original 900vh for weights summing to 7.6. */
const VH_PER_WEIGHT = 900 / 7.6;
export const TRACK_VH = Math.round(VH_PER_WEIGHT * SECTIONS.reduce((a, s) => a + s.weight, 0));
