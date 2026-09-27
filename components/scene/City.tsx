"use client";

import { useLayoutEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, ShaderMaterial } from "three";
import { getCity } from "@/lib/city";
import { SKY } from "@/lib/sky";
import { FOG_DENSITY } from "./fog";

// Floor lines and rooftop details fade out between these distances (metres).
// Dense thin lines far away are what cause moire.
const DETAIL_NEAR = 45;
const DETAIL_FAR = 130;

const vertexShader = /* glsl */ `
  attribute vec3 color;
  attribute float detail;
  varying vec3 vColor;
  varying float vDetail;
  varying float vDist;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vColor = color;
    vDetail = detail;
    vDist = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uDetailNear;
  uniform float uDetailFar;
  varying vec3 vColor;
  varying float vDetail;
  varying float vDist;
  void main() {
    float fd = uFogDensity * vDist;
    float visible = exp(-fd * fd);
    visible *= 1.0 - vDetail * smoothstep(uDetailNear, uDetailFar, vDist);
    if (visible < 0.004) discard;
    gl_FragColor = vec4(mix(uFogColor, vColor, visible), 1.0);
    #include <colorspace_fragment>
  }
`;

export function City() {
  const { geometry, material } = useMemo(() => {
    const { positions, colors, detail } = getCity();
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("color", new BufferAttribute(colors, 3));
    g.setAttribute("detail", new BufferAttribute(detail, 1));
    g.computeBoundingSphere();

    const m = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        // Shared with the scene: follows the night-to-dawn shift at Contact.
        uFogColor: { value: SKY },
        uFogDensity: { value: FOG_DENSITY },
        uDetailNear: { value: DETAIL_NEAR },
        uDetailFar: { value: DETAIL_FAR },
      },
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

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />;
}
