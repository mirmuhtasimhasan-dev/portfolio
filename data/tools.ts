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
  siSanity,
  siShopify,
  siTailwindcss,
} from "simple-icons";

export type Tool = {
  name: string;
  zone: "frontend" | "backend" | "server";
  logo: string; // svg path used for the neon tube (24 x 24 viewBox)
  level: 1 | 2 | 3; // brightness
};

// No simple-icons glyph for SEO or Liquid; simple outline paths in the same 24 x 24 box.
// React and TypeScript: simple-icons ships filled silhouettes whose outlines turn
// into doubled lines at sign size, so they get single-stroke neon versions.
const REACT_TUBE =
  "M22.00 12.00L21.91 12.50L21.66 12.98L21.24 13.45L20.66 13.90L19.93 14.31L19.07 14.69L18.09 15.01L17.00 15.29L15.83 15.51L14.59 15.67L13.31 15.77L12.00 15.80L10.69 15.77L9.41 15.67L8.17 15.51L7.00 15.29L5.91 15.01L4.93 14.69L4.07 14.31L3.34 13.90L2.76 13.45L2.34 12.98L2.09 12.50L2.00 12.00L2.09 11.50L2.34 11.02L2.76 10.55L3.34 10.10L4.07 9.69L4.93 9.31L5.91 8.99L7.00 8.71L8.17 8.49L9.41 8.33L10.69 8.23L12.00 8.20L13.31 8.23L14.59 8.33L15.83 8.49L17.00 8.71L18.09 8.99L19.07 9.31L19.93 9.69L20.66 10.10L21.24 10.55L21.66 11.02L21.91 11.50L22.00 12.00ZM17.00 20.66L16.53 20.83L15.98 20.86L15.36 20.73L14.68 20.45L13.96 20.03L13.21 19.47L12.43 18.78L11.65 17.98L10.87 17.07L10.12 16.08L9.39 15.01L8.71 13.90L8.08 12.75L7.53 11.59L7.05 10.44L6.65 9.32L6.35 8.24L6.14 7.22L6.03 6.29L6.02 5.45L6.12 4.73L6.32 4.13L6.61 3.66L7.00 3.34L7.47 3.17L8.02 3.14L8.64 3.27L9.32 3.55L10.04 3.97L10.79 4.53L11.57 5.22L12.35 6.02L13.13 6.93L13.88 7.92L14.61 8.99L15.29 10.10L15.92 11.25L16.47 12.41L16.95 13.56L17.35 14.68L17.65 15.76L17.86 16.78L17.97 17.71L17.98 18.55L17.88 19.27L17.68 19.87L17.39 20.34L17.00 20.66ZM7.00 20.66L6.61 20.34L6.32 19.87L6.12 19.27L6.02 18.55L6.03 17.71L6.14 16.78L6.35 15.76L6.65 14.68L7.05 13.56L7.53 12.41L8.08 11.25L8.71 10.10L9.39 8.99L10.12 7.92L10.87 6.93L11.65 6.02L12.43 5.22L13.21 4.53L13.96 3.97L14.68 3.55L15.36 3.27L15.98 3.14L16.53 3.17L17.00 3.34L17.39 3.66L17.68 4.13L17.88 4.73L17.98 5.45L17.97 6.29L17.86 7.22L17.65 8.24L17.35 9.32L16.95 10.44L16.47 11.59L15.92 12.75L15.29 13.90L14.61 15.01L13.88 16.08L13.13 17.07L12.35 17.98L11.57 18.78L10.79 19.47L10.04 20.03L9.32 20.45L8.64 20.73L8.02 20.86L7.47 20.83L7.00 20.66ZM13.6 12a1.6 1.6 0 1 1-3.2 0a1.6 1.6 0 1 1 3.2 0Z";
const TS_TUBE =
  "M3 2h18a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1ZM6 11h6M9 11v8M19 11.8c-.4-.6-1.1-.9-1.9-.9c-1.1 0-1.9.6-1.9 1.4c0 1.9 3.9 1.1 3.9 3.3c0 .9-.9 1.6-2.1 1.6c-.9 0-1.7-.4-2.1-1";
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
  { name: "React", zone: "frontend", logo: REACT_TUBE, level: 3 },
  { name: "Next.js", zone: "frontend", logo: siNextdotjs.path, level: 3 },
  { name: "TypeScript", zone: "frontend", logo: TS_TUBE, level: 3 },
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
