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
import { ABOUT_TIMING, aboutPhase, cityLit, smoothstep } from "@/lib/timeline";
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
  uniform float uActive;
  uniform float uTime;
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
    // The About sequence (lit city, then switch-off), exactly as scrolled.
    float about = uLit * (1.0 - smoothstep(aOffAt, aOffAt + 0.012, uPhase));

    // Outside the About sequence: a few city windows stay lit (never the
    // About house). A handful of those switch now and then or flicker.
    float h1 = fract(sin(dot(aOffset.xz, vec2(12.9898, 78.233))) * 43758.5453);
    float h2 = fract(sin(dot(aOffset.xz, vec2(39.3468, 11.1353))) * 24634.6345);
    float ambient = step(h1, 0.13) * (1.0 - aKeepNear);
    float live = 1.0;
    if (h2 < 0.1) {
      // Someone switching a light: toggles every few seconds.
      float period = 3.0 + 6.0 * h1 / 0.13;
      float slot = floor(uTime / period + h2 * 37.0);
      live = step(0.3, fract(sin(slot * 91.345 + h2 * 311.7) * 43758.5453));
    } else if (h2 < 0.16) {
      // A failing tube: steady, with a short burst of flicker now and then.
      float burst = step(fract(uTime / (5.0 + 9.0 * h2) + h2 * 7.0), 0.07);
      live = 1.0 - burst * step(0.5, fract(uTime * 17.0 + h2 * 5.0));
    }
    // Ambient lights are dimmer than the lockdown moment (under the bloom
    // threshold) and never large: they fade out closer than about 70 m.
    float ambientNear = smoothstep(50.0, 90.0, d);
    vOn = max(ambient * live * (1.0 - uActive) * 0.5 * ambientNear, nearFade * about);
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
        uActive: { value: 0 },
        uTime: { value: 0 },
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

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const p = aboutPhase(scrollStore.progress);
    const u = (m.material as ShaderMaterial).uniforms;
    u.uLit.value = cityLit(p);
    u.uPhase.value = p;
    // The About sequence owns every window while it plays: no flicker there.
    u.uActive.value = smoothstep(-1, -0.75, p) * (1 - smoothstep(1.1, 1.35, p));
    u.uTime.value = clock.elapsedTime;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} />;
}
