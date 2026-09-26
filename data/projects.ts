export type Project = {
  slug: string;
  name: string;
  year: number;
  status: "Live" | "In progress";
  what: string;
  stack: string[]; // tool names, must match data/tools.ts
  infra?: string;
  url: string;
  image: string; // /projects/<slug>.webp
  video?: string; // optional loop
  featured: boolean;
};

export const projects: Project[] = [
  {
    slug: "zubayer-life",
    name: "Zubayer.life",
    year: 2026,
    status: "Live",
    what: "Portfolio and living archive for a Dhaka filmmaker and brand consultant, content-managed through Sanity.",
    stack: ["Next.js", "TypeScript", "Sanity", "Tailwind"],
    infra: "Node behind Nginx on a self-provisioned VPS, PM2, auto-renewing certificates.",
    url: "https://zubayer.life",
    image: "/projects/zubayer-life.webp",
    featured: true,
  },
  {
    slug: "renttime",
    name: "RentTime",
    year: 2025,
    status: "Live",
    what: "Rental marketplace where listing and availability stay honest while several users act at once.",
    stack: ["React", "Tailwind", "Firebase", "Firestore", "Node.js"],
    url: "https://rent-time-bd.web.app/",
    image: "/projects/renttime.webp",
    featured: true,
  },
];
