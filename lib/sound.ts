/*
 * The optional tube-light "tick". Off by default; the toggle in the nav turns
 * it on (that click is the user gesture the browser needs for audio).
 * Generated with WebAudio, so there is no audio file to load.
 */

let enabled = false;
let ctx: AudioContext | null = null;
const listeners = new Set<(on: boolean) => void>();

export const isSoundOn = () => enabled;

export function setSound(on: boolean) {
  enabled = on;
  if (on) {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  }
  listeners.forEach((l) => l(on));
}

export function onSoundChange(l: (on: boolean) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** A tiny, quiet click: a short high blip with a fast decay. */
export function tick() {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(2400 + Math.random() * 600, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.035, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.035);
}
