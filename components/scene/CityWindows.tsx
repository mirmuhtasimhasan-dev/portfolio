"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  PlaneGeometry,
  ShaderMaterial,
  type Mesh,
} from "three";
import { getCity } from "@/lib/city";
import { getDhakaHouse } from "@/lib/dhakaHouse";
import { mulberry32 } from "@/lib/random";
import { palette } from "@/lib/palette";
import { scrollStore } from "@/lib/scrollStore";
import { ABOUT_TIMING, aboutPhase, cityLit } from "@/lib/timeline";
import { FOG_DENSITY } from "./fog";

/*
 * "Lockdown night": every lit window in the city as one instanced draw call.
 * They fade on as the camera arrives at About, then each one switches off at
 * its own point in the About hold (offAt), until only the About window is left
 * (that one is drawn by the About house, not here).
 */

const vertexShader = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec2 aSize;
  attribute float aYaw;
  attribute float aOffAt;
  attribute float aSeed;
  attribute float aKeepNear;
  uniform float uLit;
  uniform float uPhase;
  varying float vOn;
  varying float vDist;
  varying float vSeed;
  void main() {
    // Distance of the window center: far windows shrink toward dots,
    // near ones fade out so nothing turns into a big square by the camera.
    vec4 center = modelViewMatrix * vec4(aOffset, 1.0);
    float d = length(center.xyz);
    float shrink = mix(1.0, 0.4, smoothstep(40.0, 240.0, d));
    float nearFade = max(aKeepNear, smoothstep(16.0, 30.0, d));

    float c = cos(aYaw);
    float s = sin(aYaw);
    // Unit plane faces +Z; size it, then turn it to face the facade normal.
    vec2 q = position.xy * aSize * shrink;
    vec3 p = vec3(q.x * c, q.y, -q.x * s);
    vec4 mv = modelViewMatrix * vec4(aOffset + p, 1.0);
    vOn = uLit * nearFade * (1.0 - smoothstep(aOffAt, aOffAt + 0.012, uPhase));
    vDist = d;
    vSeed = aSeed;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFogDensity;
  varying float vOn;
  varying float vDist;
  varying float vSeed;
  void main() {
    float fd = uFogDensity * vDist;
    // Lower brightness, with a slight per-window warm/cool tint.
    float k = vOn * exp(-fd * fd) * (0.28 + 0.24 * vSeed);
    if (k < 0.003) discard;
    vec3 tint = vec3(1.0, 0.94 + 0.08 * vSeed, 0.82 + 0.2 * vSeed);
    gl_FragColor = vec4(uColor * tint * k, 1.0);
    #include <colorspace_fragment>
  }
`;

export function CityWindows() {
  const mesh = useRef<Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const city = getCity().windows;
    const house = getDhakaHouse().windows;
    const n = city.count + house.length;

    const offsets = new Float32Array(n * 3);
    const sizes = new Float32Array(n * 2);
    const keepNear = new Float32Array(n);
    const yaws = new Float32Array(n);
    const offAt = new Float32Array(n);
    const seeds = new Float32Array(n);
    offsets.set(city.offsets);
    sizes.set(city.sizes);
    yaws.set(city.yaws);
    offAt.set(city.offAt);
    seeds.set(city.seeds);

    // The About house's own windows go off too, floor by floor, and stay
    // visible up close (the camera is meant to be near this house).
    const rand = mulberry32(7);
    const floorOff = new Map<number, number>();
    house.forEach((w, i) => {
      const j = city.count + i;
      if (!floorOff.has(w.floor)) {
        floorOff.set(w.floor, ABOUT_TIMING.offFrom + (ABOUT_TIMING.offTo - ABOUT_TIMING.offFrom - 0.02) * rand());
      }
      offsets[j * 3] = w.position.x;
      offsets[j * 3 + 1] = w.position.y;
      offsets[j * 3 + 2] = w.position.z;
      sizes[j * 2] = w.width;
      sizes[j * 2 + 1] = w.height;
      keepNear[j] = 1;
      yaws[j] = w.yaw;
      offAt[j] = floorOff.get(w.floor)! + rand() * 0.02;
      seeds[j] = 0.6 + 0.4 * rand();
    });

    const plane = new PlaneGeometry(1, 1);
    const g = new InstancedBufferGeometry();
    g.index = plane.index;
    g.setAttribute("position", plane.getAttribute("position"));
    g.setAttribute("aOffset", new InstancedBufferAttribute(offsets, 3));
    g.setAttribute("aSize", new InstancedBufferAttribute(sizes, 2));
    g.setAttribute("aKeepNear", new InstancedBufferAttribute(keepNear, 1));
    g.setAttribute("aYaw", new InstancedBufferAttribute(yaws, 1));
    g.setAttribute("aOffAt", new InstancedBufferAttribute(offAt, 1));
    g.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    g.instanceCount = n;

    const m = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new Color(palette.window) },
        uFogDensity: { value: FOG_DENSITY },
        uLit: { value: 0 },
        uPhase: { value: -1 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, []);

  useLayoutEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const p = aboutPhase(scrollStore.progress);
    const lit = cityLit(p);
    const u = (m.material as ShaderMaterial).uniforms;
    u.uLit.value = lit;
    u.uPhase.value = p;
    // Skip the draw entirely when no window is on.
    m.visible = lit > 0.001 && p < ABOUT_TIMING.offTo + 0.02;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} />;
}
