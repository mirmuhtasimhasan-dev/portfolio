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
  attribute float aYaw;
  attribute float aOffAt;
  attribute float aSeed;
  uniform float uLit;
  uniform float uPhase;
  varying float vOn;
  varying float vDist;
  varying float vSeed;
  void main() {
    float c = cos(aYaw);
    float s = sin(aYaw);
    // Plane faces +Z; rotate it to face the facade normal.
    vec3 p = vec3(position.x * c, position.y, -position.x * s);
    vec4 mv = modelViewMatrix * vec4(aOffset + p, 1.0);
    vOn = uLit * (1.0 - smoothstep(aOffAt, aOffAt + 0.012, uPhase));
    vDist = length(mv.xyz);
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
    float k = vOn * exp(-fd * fd) * (0.45 + 0.4 * vSeed);
    if (k < 0.003) discard;
    gl_FragColor = vec4(uColor * k, 1.0);
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
    const yaws = new Float32Array(n);
    const offAt = new Float32Array(n);
    const seeds = new Float32Array(n);
    offsets.set(city.offsets);
    yaws.set(city.yaws);
    offAt.set(city.offAt);
    seeds.set(city.seeds);

    // The About house's own windows go off too, spread over the same range.
    const rand = mulberry32(7);
    house.forEach((w, i) => {
      const j = city.count + i;
      offsets[j * 3] = w.position.x;
      offsets[j * 3 + 1] = w.position.y;
      offsets[j * 3 + 2] = w.position.z;
      yaws[j] = w.yaw;
      offAt[j] = ABOUT_TIMING.offFrom + (ABOUT_TIMING.offTo - ABOUT_TIMING.offFrom) * rand();
      seeds[j] = 0.6 + 0.4 * rand();
    });

    const plane = new PlaneGeometry(1.2, 1.3);
    const g = new InstancedBufferGeometry();
    g.index = plane.index;
    g.setAttribute("position", plane.getAttribute("position"));
    g.setAttribute("aOffset", new InstancedBufferAttribute(offsets, 3));
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
