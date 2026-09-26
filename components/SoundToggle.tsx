"use client";

import { useEffect, useState } from "react";
import { isSoundOn, onSoundChange, setSound } from "@/lib/sound";

/** Mute toggle for the tube-light tick. Off by default. */
export function SoundToggle() {
  const [on, setOn] = useState(isSoundOn);
  useEffect(() => onSoundChange(setOn), []);

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setSound(!on)}
      className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-text-2 transition-colors hover:text-text aria-pressed:text-green"
      title={on ? "Mute the sign ticks" : "Turn on the sign ticks"}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 9h4l5-4v14l-5-4H4z" strokeLinejoin="round" />
        {on ? (
          <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
        ) : (
          <path d="M17 9.5l5 5M22 9.5l-5 5" strokeLinecap="round" />
        )}
      </svg>
      Sound {on ? "on" : "off"}
    </button>
  );
}
