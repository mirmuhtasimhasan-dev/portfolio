"use client";

/* ------------------------------------------------------------------
   §10 · Scramble.

   One utility, three callers: the title's hover, its return, and the
   decode a slide runs when it arrives. Each call owns a handle, and
   starting a new run on the same element means cancelling the old one
   — otherwise a fast in-and-out leaves two loops writing the same
   node and the loser wins whichever frame lands last.

   The resolve front sweeps left to right: a character past the front
   is already itself, everything ahead of it is still noise. Spaces are
   never scrambled, so the shape of the words is legible the whole way
   through rather than being one unbroken bar of glyphs.
   ------------------------------------------------------------------ */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&@$*<>/[]{}=+-?!";

/** One rendered step. Slower than a frame on purpose — at 60Hz this
    reads as a teleprinter rather than as a blur. */
const STEP_MS = 30;

const DURATION = 450;

export type ScrambleHandle = { cancel: () => void };

const NOOP: ScrambleHandle = { cancel() {} };

export function scrambleTo(
  el: HTMLElement,
  text: string,
  opts: { instant?: boolean; duration?: number } = {},
): ScrambleHandle {
  /* Reduced motion asks for the words, not the performance of them. */
  if (opts.instant) {
    el.textContent = text;
    return NOOP;
  }

  const chars = Array.from(text);
  const steps = Math.max(1, Math.round((opts.duration ?? DURATION) / STEP_MS));

  let step = 0;
  let last = 0;
  let raf = 0;
  let done = false;

  function frame(now: number) {
    if (done) return;
    /* rAF is the clock but not the cadence — anything faster than
       STEP_MS is skipped rather than rendered. */
    if (now - last < STEP_MS) {
      raf = requestAnimationFrame(frame);
      return;
    }
    last = now;

    const front = (step / steps) * chars.length;
    let out = "";
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c === " ") {
        out += " ";
      } else if (i < front) {
        out += c;
      } else {
        out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
    }
    el.textContent = out;

    step += 1;
    if (step > steps) {
      el.textContent = text; // land on the real string, exactly
      done = true;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  return {
    cancel() {
      done = true;
      cancelAnimationFrame(raf);
    },
  };
}