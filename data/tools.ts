import {
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
  siReact,
  siSanity,
  siTailwindcss,
  siTypescript,
} from "simple-icons";

export type Tool = {
  name: string;
  zone: "frontend" | "backend" | "server";
  logo: string; // svg path used for the neon tube (24 x 24 viewBox)
  level: 1 | 2 | 3; // brightness
};

// No simple-icons glyph for these two; simple outline paths in the same 24 x 24 box.
const SEO_PATH =
  "M10 3a7 7 0 1 0 4.2 12.6l5.1 5.1 1.4-1.4-5.1-5.1A7 7 0 0 0 10 3zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z";
const DATABASE_PATH =
  "M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3zM4 5c0 1.7 3.6 3 8 3s8-1.3 8-3M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3";

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

  // Backend gali: tall narrow signs
  { name: "Node.js", zone: "backend", logo: siNodedotjs.path, level: 2 },
  { name: "Firebase", zone: "backend", logo: siFirebase.path, level: 2 },
  { name: "Firestore", zone: "backend", logo: DATABASE_PATH, level: 2 },
  { name: "Sanity", zone: "backend", logo: siSanity.path, level: 2 },
  { name: "PHP", zone: "backend", logo: siPhp.path, level: 1 },
  { name: "MySQL", zone: "backend", logo: siMysql.path, level: 1 },

  // Server roof: signs on rooftops
  { name: "Nginx", zone: "server", logo: siNginx.path, level: 2 },
  { name: "PM2", zone: "server", logo: siPm2.path, level: 2 },
  { name: "Git", zone: "server", logo: siGit.path, level: 3 },
];
