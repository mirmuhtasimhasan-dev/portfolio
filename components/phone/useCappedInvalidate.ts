"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";

/** Phone mode renders at most this often, whatever asks for a frame. */
const MAX_FPS = 30;

/** invalidate() capped at MAX_FPS: calls inside the budget merge into one trailing frame. */
function capInvalidate(invalidate: () => void) {
  const st = { last: 0, timer: 0 };
  const run = () => {
    st.timer = 0;
    st.last = performance.now();
    invalidate();
  };
  const fn = () => {
    if (st.timer) return;
    const wait = st.last + 1000 / MAX_FPS - performance.now();
    if (wait <= 0) run();
    else st.timer = window.setTimeout(run, wait);
  };
  return Object.assign(fn, { cancel: () => window.clearTimeout(st.timer) });
}

/** The canvas's invalidate(), capped at 30 frames per second. */
export function useCappedInvalidate() {
  const invalidate = useThree((s) => s.invalidate);
  const [capped] = useState(() => capInvalidate(() => invalidate()));
  useEffect(() => () => capped.cancel(), [capped]);
  return capped;
}
