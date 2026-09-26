// Section order = camera stop order. The camera path is built from these ids.
// weight = share of the scroll track. About and Credentials play scroll-driven
// sequences in their holds, so they get more scroll.
export const SECTIONS = [
  { id: "hero", label: "Hero", weight: 1 },
  { id: "about", label: "About", weight: 1.8 },
  { id: "credentials", label: "Credentials", weight: 1.8 },
  { id: "toolset", label: "Toolset", weight: 1 },
  { id: "projects", label: "Projects", weight: 1 },
  { id: "contact", label: "Contact", weight: 1 },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
export const SECTION_COUNT = SECTIONS.length;
export const sectionIndex = (id: SectionId) => SECTIONS.findIndex((s) => s.id === id);

/** The tall container that produces master scroll progress. */
export const TRACK_ID = "scroll-track";
