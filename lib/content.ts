// Section copy, from docs/SPEC.md sections 4 and 7.

export const PERSON = {
  fullName: "Mir MD Muhtasim Hasan",
  shortName: "Muhtasim",
  role: "Full-stack developer",
  location: "Mohammadpur, Dhaka",
  available: true,
};

export const ABOUT = {
  lines: [
    "I picked up HTML during lockdown, out of boredom.",
    "I never put it down.",
  ],
};

export type Credential = { title: string; issuer?: string; year: number };

/** Chronological, bottom floor first: the order the building draws itself. */
export const CREDENTIALS: Credential[] = [
  { title: "Front-End Development with React", year: 2023 },
  { title: "B.Sc. Computer Science and Engineering", year: 2025 },
  { title: "Digital Marketing", issuer: "EDGE, ICT Division", year: 2025 },
];

export const CONTACT = {
  email: "mirmuhtasimhasan@gmail.com",
  phone: "+880 1906 042275",
  phoneHref: "tel:+8801906042275",
  github: "github.com/mirmuhtasimhasan-dev",
  githubHref: "https://github.com/mirmuhtasimhasan-dev",
  location: "Mohammadpur, Dhaka",
  timezone: "GMT+6",
};
