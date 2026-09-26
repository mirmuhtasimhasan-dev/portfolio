"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  Vector3,
  type LineSegments,
} from "three";
import { palette } from "@/lib/palette";
import { mulberry32 } from "@/lib/random";
import { FOG_DENSITY } from "./fog";

/*
 * Light rain: thin diagonal streaks in a box that travels with the camera,
 * denser near the camera, fading with the same fog as the city.
 *
 * It must never cover text, cards or billboards. It is drawn first, in the
 * opaque pass, without writing depth: every sign, billboard and label drawn
 * after it paints over it, so rain only ever shows in the empty space
 * between things. (The DOM text sits above the canvas anyway.)
 */

const BOX = { r: 42, h: 26 };
const STREAK = 0.9;
/** Wind slant (x, z per metre fallen) and fall speed. */
const SLANT = { x: 0.18, z: 0.07 };
const SPEED = 15;

const vertexShader = /* glsl */ `
  attribute vec4 aDrop;   // x, z offset in the box, start height, seed
  attribute float aEnd;   // 0 = streak top, 1 = streak bottom
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uBoxH;
  uniform vec2 uSlant;
  varying float vDist;
  varying float vSeed;
  varying float vEnd;
  void main() {
    float fall = mod(aDrop.z - uTime * (${SPEED.toFixed(1)} + aDrop.w * 4.0), uBoxH);
    // Camera-relative, so the dense core always stays around the camera.
    vec2 rel = aDrop.xy - uSlant * (uBoxH - fall);
    float y = uCam.y - uBoxH * 0.45 + fall - aEnd * ${STREAK.toFixed(2)};
    vec3 p = vec3(uCam.x + rel.x - uSlant.x * aEnd * ${STREAK.toFixed(2)}, y, uCam.z + rel.y - uSlant.y * aEnd * ${STREAK.toFixed(2)});
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDist = length(mv.xyz);
    vSeed = aDrop.w;
    vEnd = aEnd;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFogDensity;
  uniform float uOpacity;
  varying float vDist;
  varying float vSeed;
  varying float vEnd;
  void main() {
    float fd = uFogDensity * vDist * 3.0;
    // Near the lens streaks fade too, so none cross the view up close.
    float k = uOpacity * exp(-fd * fd) * smoothstep(2.5, 6.0, vDist) * (0.5 + 0.5 * vSeed);
    k *= 1.0 - 0.6 * vEnd; // brighter at the leading end
    if (k < 0.003) discard;
    gl_FragColor = vec4(uColor * k, 1.0);
    #include <colorspace_fragment>
  }
`;

export function Rain({ count }: { count: number }) {
  const lines = useRef<LineSegments>(null);

  const { geometry, material } = useMemo(() => {
    const r = mulberry32(2026);
    const drop = new Float32Array(count * 2 * 4);
    const end = new Float32Array(count * 2);
    const pos = new Float32Array(count * 2 * 3);
    for (let i = 0; i < count; i++) {
      // Denser near the camera: radius grows with the square of a uniform.
      const rad = BOX.r * Math.pow(r(), 1.8);
      const ang = r() * Math.PI * 2;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const y0 = r() * BOX.h;
      const seed = r();
      for (let k = 0; k < 2; k++) {
        drop.set([x, z, y0, seed], (i * 2 + k) * 4);
        end[i * 2 + k] = k;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aDrop", new BufferAttribute(drop, 4));
    g.setAttribute("aEnd", new BufferAttribute(end, 1));
    const m = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uCam: { value: new Vector3() },
        uTime: { value: 0 },
        uBoxH: { value: BOX.h },
        uSlant: { value: [SLANT.x, SLANT.z] },
        uColor: { value: new Color(palette.text2).lerp(new Color(palette.green), 0.15) },
        uFogDensity: { value: FOG_DENSITY },
        uOpacity: { value: 0.2 },
      },
      // Opaque pass + additive + no depth write: drawn before everything, and
      // painted over by every object after it (see the note at the top).
      transparent: false,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return { geometry: g, material: m };
  }, [count]);

  useLayoutEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame(({ clock, camera }) => {
    const l = lines.current;
    if (!l) return;
    const u = (l.material as ShaderMaterial).uniforms;
    u.uTime.value = clock.elapsedTime;
    (u.uCam.value as Vector3).copy(camera.position);
  });

  if (count <= 0) return null;
  return <lineSegments ref={lines} geometry={geometry} material={material} frustumCulled={false} renderOrder={-100} />;
}
