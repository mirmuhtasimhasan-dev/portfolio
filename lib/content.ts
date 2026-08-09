/**
 * The single source of truth for every word on the page.
 * Components read from here; nothing is hard-coded in JSX.
 */

export type NavLink = {
  /** id of the section this points at, without the hash */
  id: string;
  label: string;
};

export type Principle = {
  /** roman numeral used as the marker */
  numeral: string;
  title: string;
  body: string;
};

export type Credential = {
  title: string;
  issuer: string | null;
  year: string;
};

/** A 2400×1500 (16:10) image for a device screen. */
export type Shot = {
  src: string;
  width: number;
  height: number;
  /**
   * Empty when the picture only repeats copy that is real text nearby —
   * describing it again just reads the section twice.
   */
  alt: string;
};

/** One labelled row of a project's spec sheet. */
export type Spec = { label: string; value: string };

export type Project = {
  index: string;
  name: string;
  year: string;
  /** rendered as the first row, with the mint dot */
  status: string;
  specs: Spec[];
  href: string;
  shot: Shot;
};

export type ContactLink = {
  label: string;
  value: string;
  /** null when there is nothing to link to yet */
  href: string | null;
  note?: string;
};

export type Content = {
  identity: {
    name: string;
    role: string;
    location: string;
    availability: string;
    headline: string;
    sub: string;
    /** hero display name, kept separate from the legal name */
    greeting: string;
  };
  nav: NavLink[];
  hero: {
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
  };
  about: {
    eyebrow: string;
    /** doubles as the section's h2 */
    heading: string;
    body: string[];
    principlesEyebrow: string;
    principles: Principle[];
    /** The screenshot shown in the tilting device. */
    shot: Shot;
  };
  experience: {
    eyebrow: string;
    heading: string;
    credentials: Credential[];
    toolsetEyebrow: string;
    toolset: string[];
  };
  projects: {
    eyebrow: string;
    heading: string;
    items: Project[];
  };
  contact: {
    eyebrow: string;
    heading: string;
    email: string;
    links: ContactLink[];
    footnote: string;
  };
};

export const content: Content = {
  identity: {
    name: "Mir MD Muhtasim Hasan",
    role: "Full-stack developer",
    location: "Dhaka",
    availability: "Available for work",
    greeting: "Hi. I'm Muhtasim.",
    headline: "I build websites that behave as carefully as they look.",
    sub: "React and Next.js on the surface, Nginx, PM2 and a VPS underneath.",
  },

  nav: [
    { id: "home", label: "Home" },
    { id: "about", label: "About" },
    { id: "experience", label: "Experience" },
    { id: "projects", label: "Projects" },
    { id: "contact", label: "Contact" },
  ],

  hero: {
    primaryCta: { label: "Explore My Work", href: "#about" },
    secondaryCta: { label: "My Resume", href: "/resume.pdf" },
  },

  about: {
    eyebrow: "About Me",
    heading:
      "I picked up HTML during lockdown out of boredom and never really put it down.",
    body: [
      "I took the front-end course at Creative IT in 2023 to fill the gaps, then finished my Computer Science degree. I'm based in Mohammadpur, Dhaka, and I build websites with React and Next.js.",
      "zubayer.life is the one I'd point at first: a portfolio and archive for a filmmaker, built in Next.js with a CMS behind it so he can publish his own work. Before that, RentTime and a few smaller builds while I was learning.",
      "Open to front-end roles and freelance work.",
    ],
    /* Kept, but not currently placed on the page — the About panel shows the
       About Me copy only. Reinstate by rendering these in a section of their
       own; the .principle* styles are still in globals.css. */
    principlesEyebrow: "How I work",
    principles: [
      {
        numeral: "i",
        title: "The numbers decide",
        body: "Fast is not a feeling. I watch the bundle, the layout shift, the time to first byte — and when one moves the wrong way, I know which commit did it.",
      },
      {
        numeral: "ii",
        title: "Write it, don't install it",
        body: "A dependency is a bill someone else pays, on a mid-range phone on 4G in Dhaka. Most of what a page needs is forty lines. I write the forty lines.",
      },
      {
        numeral: "iii",
        title: "Done means deployed",
        body: "A passing build is not a finished job. I provision the server, configure the proxy, renew the certificates, and answer for it when something breaks at 3am.",
      },
    ],
    /* What the device's screen shows: a real 2400×1500 capture of the About Me
       card below it. WebP because the field's per-pixel noise makes a PNG of
       the same frame 2.3 MB — see README for how to regenerate. */
    shot: {
      src: "/showcase.webp",
      width: 2400,
      height: 1500,
      alt: "", // it pictures the About copy, which is real text in this section
    },
  },

  experience: {
    eyebrow: "Experience",
    heading: "Credentials",
    credentials: [
      {
        title: "B.Sc. Computer Science & Engineering",
        issuer: null,
        year: "2025",
      },
      { title: "Front-End Development with React", issuer: null, year: "2023" },
      { title: "Digital Marketing", issuer: "EDGE ICT Division", year: "2025" },
    ],
    toolsetEyebrow: "Toolset",
    toolset: [
      "React",
      "Next.js",
      "TypeScript",
      "JavaScript",
      "Tailwind",
      "Sanity",
      "Firebase",
      "Node.js",
      "PHP",
      "MySQL",
      "Nginx",
      "PM2",
      "Git",
      "Figma",
      "SEO",
    ],
  },

  projects: {
    eyebrow: "Projects",
    heading: "Selected work",
    items: [
      {
        index: "01",
        name: "Zubayer.life",
        year: "2026",
        status: "Live",
        specs: [
          {
            label: "What",
            value:
              "Portfolio and living archive for a Dhaka filmmaker and brand consultant. Organised by intent rather than by medium, content-managed through Sanity so new films, photo series and essays publish without a deploy.",
          },
          {
            label: "Stack",
            value: "Next.js · TypeScript · Sanity · Tailwind",
          },
          {
            label: "Infra",
            value:
              "A Node process behind an Nginx reverse proxy on a VPS I provisioned, kept alive by PM2, certificates renewing on their own.",
          },
        ],
        href: "https://zubayer.life",
        shot: {
          src: "/projects/zubayer.webp",
          width: 2400,
          height: 1500,
          alt: "The zubayer.life home page: a serif headline reading “Some people choose a lane. I chose a problem.” over a pale ground, with Gallery, Ventures, Writing, Engagements, About and Contact in the nav.",
        },
      },
      {
        index: "02",
        name: "RentTime",
        year: "2025",
        status: "Live",
        specs: [
          {
            label: "What",
            value:
              "Rental marketplace where listing and availability state stays honest while several users act on the same property at once. Firestore resolves a change everywhere without a refresh.",
          },
          {
            label: "Stack",
            value: "React · Tailwind · Firebase · Firestore · Node.js",
          },
        ],
        href: "https://rent-time-bd.web.app/",
        shot: {
          src: "/projects/renttime.webp",
          width: 2400,
          height: 1500,
          alt: "The RentTime home page: “Rent Time — Home Renting Made Simple” in white over a deep violet hero, with Explore Properties and Learn More buttons and a Houses / Roommates / Blog nav.",
        },
      },
    ],
  },

  contact: {
    eyebrow: "Contact",
    heading: "Say hello",
    email: "mirmuhtasimhasan@gmail.com",
    links: [
      {
        label: "GitHub",
        value: "mirmuhtasimhasan-dev",
        href: "https://github.com/mirmuhtasimhasan-dev",
      },
      // No URL yet — rendered as plain text rather than a dead link.
      { label: "LinkedIn", value: "TODO", href: null, note: "no URL yet" },
      { label: "Phone", value: "+880 1906 042275", href: "tel:+8801906042275" },
      { label: "Where", value: "Mohammadpur, Dhaka · GMT+6", href: null },
    ],
    footnote: "Mohammadpur, Dhaka · GMT+6",
  },
};