import { sectionIndex } from "./sections";

/** Top nav: where each link scrolls to, and which sections mark it current. */
export const scrollNav = [
  {
    label: "About",
    target: sectionIndex("about"),
    sections: [sectionIndex("about"), sectionIndex("credentials")],
  },
  {
    label: "Work",
    target: sectionIndex("projects"),
    sections: [sectionIndex("toolset"), sectionIndex("projects")],
  },
  {
    label: "Contact",
    target: sectionIndex("contact"),
    sections: [sectionIndex("contact")],
  },
];
