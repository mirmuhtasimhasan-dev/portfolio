// Section order = camera stop order. The camera path is built from these ids.
export const SECTIONS = [
  { id: "hero", label: "Hero" },
  { id: "about", label: "About" },
  { id: "credentials", label: "Credentials" },
  { id: "toolset", label: "Toolset" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
export const SECTION_COUNT = SECTIONS.length;
