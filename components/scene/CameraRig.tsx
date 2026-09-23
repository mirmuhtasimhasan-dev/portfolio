"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { Vector3 } from "three";
import { sampleCamera } from "@/lib/paths";
import { scrollStore } from "@/lib/scrollStore";
import { stopToSection } from "@/lib/stopMap";

// Damping (seconds to roughly reach target). Look lags a bit more than position.
const POS_SMOOTH = 0.35;
const LOOK_SMOOTH = 0.45;
// Hard cap on how fast the view can turn (radians per second).
const MAX_TURN = 1.4;
// Tiny idle float so a held frame still feels alive.
const FLOAT_AMP = 0.06;

const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

type Props = {
  /** Called in reduced-motion mode when the camera needs a cut to a new stop. */
  onCut?: (apply: () => void) => void;
};

export function CameraRig({ onCut }: Props) {
  const camera = useThree((s) => s.camera);
  const state = useRef({
    targetPos: new Vector3(),
    targetLook: new Vector3(),
    pos: new Vector3(),
    look: new Vector3(),
    dir: new Vector3(),
    yaw: 0,
    pitch: 0,
    initialized: false,
    cutStop: -1,
    cutPending: false,
    // fps
    frames: 0,
    acc: 0,
  });

  // Reset on remount (HMR) so we snap instead of flying in from the origin.
  useEffect(() => {
    state.current.initialized = false;
  }, []);

  useFrame((_, rawDelta) => {
    const st = state.current;
    const delta = Math.min(rawDelta, 0.1);

    st.frames++;
    st.acc += rawDelta;
    if (st.acc >= 0.5) {
      scrollStore.fps = st.frames / st.acc;
      st.frames = 0;
      st.acc = 0;
    }

    const s = scrollStore.stop;

    // Reduced motion: no fly-through, only cuts between stop frames.
    if (scrollStore.reducedMotion) {
      const stop = stopToSection(s);
      if (stop !== st.cutStop && !st.cutPending) {
        const apply = () => {
          sampleCamera(stop, st.pos, st.look);
          st.cutStop = stop;
          st.cutPending = false;
          st.initialized = false;
        };
        if (st.cutStop === -1 || !onCut) apply();
        else {
          st.cutPending = true;
          onCut(apply);
        }
      }
      if (!st.initialized) {
        camera.position.copy(st.pos);
        camera.lookAt(st.look);
        st.initialized = true;
      }
      return;
    }
    st.cutStop = -1;

    sampleCamera(s, st.targetPos, st.targetLook);

    if (!st.initialized) {
      st.pos.copy(st.targetPos);
      st.look.copy(st.targetLook);
    } else {
      easing.damp3(st.pos, st.targetPos, POS_SMOOTH, delta);
      easing.damp3(st.look, st.targetLook, LOOK_SMOOTH, delta);
    }

    // Yaw/pitch from the damped look target; roll is always zero.
    st.dir.subVectors(st.look, st.pos);
    const yaw = Math.atan2(-st.dir.x, -st.dir.z);
    const pitch = Math.atan2(st.dir.y, Math.hypot(st.dir.x, st.dir.z));

    if (!st.initialized) {
      st.yaw = yaw;
      st.pitch = pitch;
      st.initialized = true;
    } else {
      const maxStep = MAX_TURN * delta;
      const dy = wrapPi(yaw - st.yaw);
      st.yaw = wrapPi(st.yaw + Math.max(-maxStep, Math.min(maxStep, dy)));
      const dp = pitch - st.pitch;
      st.pitch += Math.max(-maxStep, Math.min(maxStep, dp));
    }

    const t = performance.now() / 1000;
    camera.position.set(
      st.pos.x + Math.sin(t * 0.5) * FLOAT_AMP,
      st.pos.y + Math.sin(t * 0.7 + 1.3) * FLOAT_AMP,
      st.pos.z
    );
    camera.rotation.set(st.pitch, st.yaw, 0, "YXZ");
  });

  return null;
}
