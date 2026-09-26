/*
 * Scroll-driven sequences, all as pure functions of master progress.
 * Phases come from sectionPhase(): -1..0 incoming travel, 0..1 hold,
 * 1..2 outgoing travel. Scrolling up runs everything backwards exactly.
 */
import { progressToStop, sectionPhase } from "./stopMap";
import { sectionIndex } from "./sections";

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const HERO = sectionIndex("hero");
const ABOUT = sectionIndex("about");
const CREDENTIALS = sectionIndex("credentials");

/* ---------- About: "lockdown night" ---------- */

export const aboutPhase = (progress: number) => sectionPhase(progress, ABOUT);

export const ABOUT_TIMING = {
  /** City windows fade on while the camera dives in. */
  litFrom: -0.7,
  litTo: -0.3,
  /** Each window switches off at a random point in this range. */
  offFrom: 0.03,
  offTo: 0.36,
  /** Camera eases a little toward the last window. */
  pushFrom: 0.3,
  pushTo: 0.58,
  /** Screen types "<h1>Hello</h1>". */
  typeFrom: 0.58,
  typeTo: 0.8,
  /** Then the About text fades in. */
  textFrom: 0.8,
  textTo: 0.92,
};

/** 0..1 how lit the city is before the switch-off (per-window off is in the shader). */
export const cityLit = (p: number) => smoothstep(ABOUT_TIMING.litFrom, ABOUT_TIMING.litTo, p);

/** 0..1 camera push toward the last window; eases back out as the camera leaves. */
export const aboutPush = (p: number) =>
  smoothstep(ABOUT_TIMING.pushFrom, ABOUT_TIMING.pushTo, p) * (1 - smoothstep(1.02, 1.5, p));

/** Typed characters 0..1 of the snippet. */
export const aboutTyped = (p: number) =>
  clamp01((p - ABOUT_TIMING.typeFrom) / (ABOUT_TIMING.typeTo - ABOUT_TIMING.typeFrom));

/** Screen card visibility. */
export const aboutScreen = (p: number) =>
  smoothstep(ABOUT_TIMING.pushTo - 0.06, ABOUT_TIMING.typeFrom + 0.02, p) * (1 - smoothstep(1.02, 1.25, p));

/** About text reveal (multiplied with the normal section fade). */
export const aboutText = (p: number) => smoothstep(ABOUT_TIMING.textFrom, ABOUT_TIMING.textTo, p);

export const ABOUT_SNIPPET = "<h1>Hello</h1>";

/* ---------- Credentials: "building myself" ---------- */

export const credentialsPhase = (progress: number) => sectionPhase(progress, CREDENTIALS);

/** Floor k draws during [start, start + draw], then lights during [.., + light]. */
export const CREDENTIALS_TIMING = {
  starts: [0.03, 0.32, 0.61],
  draw: 0.19,
  light: 0.07,
};

export const floorLight = (q: number, k: number) => {
  const s = CREDENTIALS_TIMING.starts[k] + CREDENTIALS_TIMING.draw;
  return smoothstep(s, s + CREDENTIALS_TIMING.light, q);
};

/* ---------- Red hints (never in the hero) ---------- */

/** 0 through the hero hold, 1 once the camera is on its way down. */
export const redGate = (progress: number) => smoothstep(1.15, 1.7, sectionPhase(progress, HERO));

/** Horizon glow: grows a little each section toward Contact. */
export function horizonGlow(progress: number) {
  const s = progressToStop(progress);
  const g = clamp01((s - 0.5) / 4.5);
  return redGate(progress) * (0.1 + 0.5 * g * g);
}

/* ---------- Toolset: Neon Bazaar ---------- */

const TOOLSET = sectionIndex("toolset");
export const toolsetPhase = (progress: number) => sectionPhase(progress, TOOLSET);

/** Brightness per tool level (lit), and the dim "off" tube. */
export const SIGN_DIM = 0.1;
export const SIGN_LEVEL = [0.5, 0.75, 1] as const;

/**
 * Tube-light start: alternating on/off durations (seconds), 2 or 3 flickers,
 * then steady. Deterministic per sign.
 */
export function flickerPattern(seed: number): number[] {
  const r = (k: number) => {
    const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const flickers = 2 + Math.round(r(0));
  const out: number[] = [];
  for (let i = 0; i < flickers; i++) out.push(0.04 + 0.05 * r(i + 1), 0.06 + 0.12 * r(i + 11));
  return out;
}
