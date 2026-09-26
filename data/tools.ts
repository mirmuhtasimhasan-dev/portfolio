import {
  siDocker,
  siFigma,
  siFirebase,
  siGit,
  siJavascript,
  siMysql,
  siNextdotjs,
  siNginx,
  siNodedotjs,
  siPhp,
  siPm2,
  siPostgresql,
  siPrisma,
  siReact,
  siSanity,
  siShopify,
  siTailwindcss,
  siTypescript,
} from "simple-icons";

export type Tool = {
  name: string;
  zone: "frontend" | "backend" | "server";
  logo: string; // svg path used for the neon tube (24 x 24 viewBox)
  level: 1 | 2 | 3; // brightness
};

// No simple-icons glyph for SEO or Liquid; simple outline paths in the same 24 x 24 box.
const LIQUID_PATH =
  "M12 2.5C9.2 6.6 5.5 10.6 5.5 14.6a6.5 6.5 0 0 0 13 0c0-4-3.7-8-6.5-12.1zm0 3.4c2.1 3 4.5 6 4.5 8.7a4.5 4.5 0 0 1-9 0c0-2.7 2.4-5.7 4.5-8.7z";
const SEO_PATH =
  "M10 3a7 7 0 1 0 4.2 12.6l5.1 5.1 1.4-1.4-5.1-5.1A7 7 0 0 0 10 3zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z";

/*
 * Order inside a zone = order along the street, nearest first.
 * Levels are a first guess; edit them freely. Brightness follows level.
 */
export const tools: Tool[] = [
  // Frontend street: shop signboards
  { name: "React", zone: "frontend", logo: siReact.path, level: 3 },
  { name: "Next.js", zone: "frontend", logo: siNextdotjs.path, level: 3 },
  { name: "TypeScript", zone: "frontend", logo: siTypescript.path, level: 3 },
  { name: "JavaScript", zone: "frontend", logo: siJavascript.path, level: 3 },
  { name: "Tailwind", zone: "frontend", logo: siTailwindcss.path, level: 3 },
  { name: "Figma", zone: "frontend", logo: siFigma.path, level: 2 },
  { name: "SEO", zone: "frontend", logo: SEO_PATH, level: 2 },
  { name: "Shopify", zone: "frontend", logo: siShopify.path, level: 2 },
  { name: "Liquid", zone: "frontend", logo: LIQUID_PATH, level: 2 },

  // Backend gali: tall narrow signs
  { name: "Node.js", zone: "backend", logo: siNodedotjs.path, level: 2 },
  { name: "Firebase", zone: "backend", logo: siFirebase.path, level: 2 },
  { name: "Sanity", zone: "backend", logo: siSanity.path, level: 2 },
  { name: "PHP", zone: "backend", logo: siPhp.path, level: 1 },
  { name: "MySQL", zone: "backend", logo: siMysql.path, level: 1 },
  { name: "PostgreSQL", zone: "backend", logo: siPostgresql.path, level: 2 },
  { name: "Prisma", zone: "backend", logo: siPrisma.path, level: 2 },

  // Server roof: signs on rooftops
  { name: "Nginx", zone: "server", logo: siNginx.path, level: 2 },
  { name: "PM2", zone: "server", logo: siPm2.path, level: 2 },
  { name: "Git", zone: "server", logo: siGit.path, level: 3 },
  { name: "Docker", zone: "server", logo: siDocker.path, level: 2 },
];
