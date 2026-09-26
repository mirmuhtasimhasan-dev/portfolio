import { sectionIndex } from "./sections";

/**
 * Top nav: where each link scrolls to (section + phase through its hold), and
 * which sections mark it current. About lands at the end of its sequence, with
 * the text showing.
 */
export const scrollNav = [
  {
    label: "About",
    target: sectionIndex("about"),
    phase: 0.97,
    sections: [sectionIndex("about"), sectionIndex("credentials")],
  },
  {
    label: "Work",
    target: sectionIndex("projects"),
    phase: 0.5,
    sections: [sectionIndex("toolset"), sectionIndex("projects")],
  },
  {
    label: "Contact",
    target: sectionIndex("contact"),
    phase: 0.5,
    sections: [sectionIndex("contact")],
  },
];
