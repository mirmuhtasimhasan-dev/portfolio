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

// Featured projects appear on the bridge in this order.
export const projects: Project[] = [
  {
    slug: "agent-wise-x",
    name: "Agent Wise X",
    year: 2026,
    status: "Live",
    what: "Full website for a Dhaka growth agency, with services, free tools with PDF reports, guides, news, an admin panel and lead capture.",
    stack: ["Next.js", "JavaScript", "PostgreSQL", "Prisma", "Docker"],
    infra: "Docker on a Hetzner VPS, Postgres, Backblaze B2 storage, JWT auth with Google sign-in.",
    url: "https://agentwisex.com",
    image: "/projects/agent-wise-x.webp",
    featured: true,
  },
  {
    slug: "zubayer-life",
    name: "Zubayer.life",
    year: 2026,
    status: "Live",
    what: "Portfolio and living archive for a Dhaka filmmaker and brand consultant, content-managed through Sanity.",
    stack: ["Next.js", "TypeScript", "Sanity", "Tailwind", "Nginx", "PM2", "Git"],
    infra: "Node behind Nginx on a self-provisioned VPS, PM2, auto-renewing certificates.",
    url: "https://zubayer.life",
    image: "/projects/zubayer-life.webp",
    featured: true,
  },
  {
    slug: "crimson-and-co",
    name: "Crimson & Co",
    year: 2026,
    status: "Live",
    what: "Shopify store for an old-money menswear brand in Bangladesh, with custom theme sections, bundle offers, reviews and cash on delivery.",
    stack: ["Shopify", "Liquid", "JavaScript"],
    url: "https://shopcrimson.co",
    image: "/projects/crimson-and-co.webp",
    featured: true,
  },
  {
    slug: "renttime",
    name: "RentTime",
    year: 2025,
    status: "Live",
    what: "Rental marketplace where listing and availability stay honest while several users act at once.",
    stack: ["React", "JavaScript", "Tailwind", "Firebase", "Node.js", "Git"],
    url: "https://rent-time-bd.web.app/",
    image: "/projects/renttime.webp",
    featured: true,
  },
];
