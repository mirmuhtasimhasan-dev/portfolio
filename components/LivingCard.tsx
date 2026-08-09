"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------
   A card with its own weather.

   The page field showing through frosted glass can only ever sit still —
   it belongs to the page, not to the card. This gives the card its own
   mesh, so three layers can move at three rates and the eye reads depth:
   the card tilts toward the cursor, the content lifts on Z, and the mesh
   slides the other way.
   ------------------------------------------------------------------ */

const VERT = `
attribute vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 u_res; uniform float u_t; uniform vec2 u_par; uniform vec2 u_m; uniform float u_hov;
uniform float u_burst;
uniform vec3 u_base, u_mint, u_lilac, u_peach;

float blob(vec2 p, vec2 c, float r){ float d = length(p-c); return r/(d*d+0.025); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }

void main(){
  vec2 uv = gl_FragCoord.xy/u_res;
  vec2 p  = (gl_FragCoord.xy - 0.5*u_res)/u_res.y;
  p += u_par;
  vec2 m = (u_m*u_res - 0.5*u_res)/u_res.y;
  m += u_par;
  float t = u_t*0.20;

  float f = 0.0;
  f += blob(p, vec2(-0.92+sin(t*0.63)*0.16,  0.30+cos(t*0.51)*0.12), 0.062);
  f += blob(p, vec2( 0.78+cos(t*0.44)*0.14,  0.36+sin(t*0.60)*0.11), 0.055);
  f += blob(p, vec2( 1.02+sin(t*0.37)*0.13, -0.28+cos(t*0.72)*0.13), 0.050);
  f += blob(p, vec2(-0.66+cos(t*0.55)*0.15, -0.34+sin(t*0.41)*0.12), 0.048);
  f += blob(p, vec2( 0.06+sin(t*0.29)*0.22,  0.02+cos(t*0.33)*0.16), 0.030);
  // the cursor is a light source inside the card, and a click disturbs it —
  // the same two gestures the page field answers to
  f += blob(p, m, 0.030 + u_hov*0.050 + u_burst*0.085);
  float ring = sin(length(p-m)*17.0 - u_t*3.4) * exp(-length(p-m)*3.0) * u_burst;
  f += ring*0.55;

  vec3 col = u_base;
  col = mix(col, u_mint,  smoothstep(0.42,1.10,f));
  col = mix(col, u_lilac, smoothstep(0.95,1.90,f));
  col = mix(col, u_peach, smoothstep(1.75,2.85,f));

  col += (hash(gl_FragCoord.xy + fract(u_t)) - 0.5)*0.020;
  col *= smoothstep(1.55,0.30,length(uv-0.5)*1.15)*0.10 + 0.90;
  gl_FragColor = vec4(col, 1.0);
}
`;

type Palette = {
  base: [number, number, number];
  mint: [number, number, number];
  lilac: [number, number, number];
  peach: [number, number, number];
  veil: string;
  sheenA: number;
  sheenB: number;
  glow: number;
};

const LIGHT: Palette = {
  base: [0.949, 0.945, 0.933],
  mint: [0.612, 0.886, 0.8],
  lilac: [0.694, 0.643, 0.949],
  peach: [0.988, 0.686, 0.573],
  veil: "linear-gradient(180deg, rgba(252,252,250,0.42), rgba(252,252,250,0.60))",
  sheenA: 0.66,
  sheenB: 0.18,
  glow: 0.55,
};

const DARK: Palette = {
  base: [0.086, 0.094, 0.118],
  mint: [0.176, 0.404, 0.361],
  lilac: [0.286, 0.263, 0.475],
  peach: [0.451, 0.29, 0.239],
  veil: "linear-gradient(180deg, rgba(18,20,26,0.55), rgba(18,20,26,0.55))",
  sheenA: 0.22,
  sheenB: 0.06,
  glow: 0.18,
};

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function LivingCard({
  children,
}: {
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<HTMLCanvasElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    const canvas = meshRef.current;
    const veil = veilRef.current;
    const glow = glowRef.current;
    const sheen = sheenRef.current;
    const content = contentRef.current;
    if (!card || !canvas || !veil || !glow || !sheen || !content) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const canHover = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    /* Tilt, sheen and glow are pointer affordances. The mesh is not — it
       renders everywhere, just still under reduced motion. */
    const lit = canHover && !reduced;

    /* No dark theme ships yet, so this is keyed to an explicit data-theme
       rather than prefers-color-scheme: reacting to the OS would turn this one
       card dark inside an otherwise light page. */
    const readTheme = (): Palette =>
      document.documentElement.dataset.theme === "dark" ? DARK : LIGHT;
    let pal = readTheme();

    let gl: WebGLRenderingContext | null = null;
    let prog: WebGLProgram | null = null;
    let buf: WebGLBuffer | null = null;
    let uRes: WebGLUniformLocation | null = null;
    let uT: WebGLUniformLocation | null = null;
    let uPar: WebGLUniformLocation | null = null;
    let uM: WebGLUniformLocation | null = null;
    let uHov: WebGLUniformLocation | null = null;
    let uBurst: WebGLUniformLocation | null = null;

    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      }) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }

    if (gl) {
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      prog = gl.createProgram();
      if (vs && fs && prog) {
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          gl.deleteShader(vs);
          gl.deleteShader(fs);
          gl.useProgram(prog);
          buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 3, -1, -1, 3]),
            gl.STATIC_DRAW,
          );
          const loc = gl.getAttribLocation(prog, "p");
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
          uRes = gl.getUniformLocation(prog, "u_res");
          uT = gl.getUniformLocation(prog, "u_t");
          uPar = gl.getUniformLocation(prog, "u_par");
          uM = gl.getUniformLocation(prog, "u_m");
          uHov = gl.getUniformLocation(prog, "u_hov");
          uBurst = gl.getUniformLocation(prog, "u_burst");
        } else {
          prog = null;
        }
      } else {
        prog = null;
      }
      if (!prog) gl = null;
    }

    if (!gl) canvas.setAttribute("data-webgl", "off");

    function applyPalette() {
      if (!veil) return;
      veil.style.background = pal.veil;
      if (gl && prog) {
        gl.uniform3f(
          gl.getUniformLocation(prog, "u_base"),
          ...(pal.base as [number, number, number]),
        );
        gl.uniform3f(
          gl.getUniformLocation(prog, "u_mint"),
          ...(pal.mint as [number, number, number]),
        );
        gl.uniform3f(
          gl.getUniformLocation(prog, "u_lilac"),
          ...(pal.lilac as [number, number, number]),
        );
        gl.uniform3f(
          gl.getUniformLocation(prog, "u_peach"),
          ...(pal.peach as [number, number, number]),
        );
      }
    }
    applyPalette();

    /* ---- motion state ------------------------------------------------ */
    let tx = 0; // target offsets from centre, -0.5 … 0.5
    let ty = 0;
    let tHov = 0;
    let tmx = 0.5; // target cursor position, 0 … 1
    let tmy = 0.5;

    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    let hov = 0;
    let mx = 0.5;
    let my = 0.5;
    let burst = 0;

    let clock = 0;
    let last = 0;
    let acc = 0;
    let raf = 0;
    let running = false;
    let onScreen = false;
    let disposed = false;
    let bufW = -1;
    let bufH = -1;

    let lastShadow = "";
    let lastSheen = "";
    let lastGlow = "";

    function resize() {
      if (!canvas || !card) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const w = Math.max(1, Math.round(card.clientWidth * dpr));
      const h = Math.max(1, Math.round(card.clientHeight * dpr));
      if (w === bufW && h === bufH) return;
      bufW = w;
      bufH = h;
      canvas.width = w;
      canvas.height = h;
      if (gl) {
        gl.viewport(0, 0, w, h);
        paintMesh();
      }
    }

    function paintMesh() {
      if (!gl || !prog) return;
      gl.uniform2f(uRes, bufW, bufH);
      gl.uniform1f(uT, clock);
      /* the mesh slides against the tilt — that opposition is the illusion */
      gl.uniform2f(uPar, -x * 0.11, y * 0.11);
      /* WebGL's Y runs the other way to the DOM's; unflipped, the light
         follows the cursor upside down */
      gl.uniform2f(uM, mx, 1 - my);
      gl.uniform1f(uHov, hov);
      gl.uniform1f(uBurst, burst);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function paintLayers() {
      if (!card || !sheen || !glow || !content) return;

      card.style.transform = `rotateY(${x * 6.2}deg) rotateX(${-y * 4.96}deg) translateY(${-hov * 5}px)`;
      /* The lift, without translateZ — see globals.css: a canvas inside a
         preserve-3d subtree renders but never composites. Moving with the
         cursor while the mesh moves against it is the same parallax read, and
         a pure translate can never resample the text the way a Z push does. */
      content.style.transform = `translate(${x * 7}px, ${y * 6 - hov * 5}px)`;

      const shadow = `0 ${(24 + y * 18).toFixed(1)}px ${(70 + Math.abs(x) * 26).toFixed(1)}px rgba(40,35,60,${(0.1 + Math.abs(x) * 0.05).toFixed(3)})`;
      if (shadow !== lastShadow) {
        lastShadow = shadow;
        card.style.boxShadow = shadow;
      }

      /* Quantised before it is written: a filter/gradient change re-rasterises
         the layer, so feeding it a fresh fractional value every frame is its
         own jank. */
      const ang = Math.round(110 + x * 80);
      const s = `linear-gradient(${ang}deg, transparent 33%, rgba(255,255,255,${pal.sheenA}) 47%, rgba(255,255,255,${pal.sheenB}) 54%, transparent 68%)`;
      if (s !== lastSheen) {
        lastSheen = s;
        sheen.style.background = s;
      }
      sheen.style.opacity = (hov * 0.62).toFixed(2);

      const gx = Math.round(mx * 1000) / 10;
      const gy = Math.round(my * 1000) / 10;
      const g = `radial-gradient(380px circle at ${gx}% ${gy}%, rgba(255,255,255,${pal.glow}), transparent 62%)`;
      if (g !== lastGlow) {
        lastGlow = g;
        glow.style.background = g;
      }
      glow.style.opacity = (hov * 0.3).toFixed(2);
    }

    /* One fixed step, so the spring's overshoot feels the same at 60Hz and
       144Hz. The constants are per-step, exactly as specified. */
    const STEP = 1000 / 60;

    /* Still a spring, but taken just past critical damping so it glides in
       and stops rather than ringing. For this discrete form the boundary is
       (1 + d - d*k)^2 = 4d; at k = 0.14 that puts d at about 0.515, so 0.50
       settles without a wobble while staying quick off the mark. */
    function advance() {
      vx += (tx - x) * 0.14;
      vy += (ty - y) * 0.14;
      vx *= 0.5;
      vy *= 0.5;
      x += vx;
      y += vy;
      hov += (tHov - hov) * 0.08;
      mx += (tmx - mx) * 0.1;
      my += (tmy - my) * 0.1;
      burst *= 0.945;
      if (burst < 0.0015) burst = 0;
    }

    function frame(now: number) {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(50, now - last);
      last = now;
      clock += dt / 1000;

      acc = Math.min(acc + dt, 200);
      while (acc >= STEP) {
        advance();
        acc -= STEP;
      }

      paintMesh();
      if (lit) paintLayers();
    }

    function start() {
      if (running || disposed || !onScreen || document.hidden) return;
      if (reduced) return; // the mesh is painted once and left alone
      running = true;
      last = performance.now(); // reset the delta clock so it does not jump
      acc = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function onPointerMove(e: PointerEvent) {
      const r = card!.getBoundingClientRect();
      tmx = (e.clientX - r.left) / r.width;
      tmy = (e.clientY - r.top) / r.height;
      tx = tmx - 0.5;
      ty = tmy - 0.5;
      tHov = 1;
    }

    function onPointerLeave() {
      tx = 0;
      ty = 0;
      tHov = 0;
      tmx = 0.5;
      tmy = 0.5;
    }

    /* The page field answers a click with a swell and a ring; the card's mesh
       answers the same way, so the two read as one material. */
    function onPointerDown() {
      burst = 1;
    }

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(card);

    /* The card changes height when the copy reflows, and a window listener
       never hears about that. */
    const ro = new ResizeObserver(() => {
      resize();
      if (!running) paintMesh();
    });
    ro.observe(card);

    const themeObserver = new MutationObserver(() => {
      pal = readTheme();
      lastSheen = lastGlow = "";
      applyPalette();
      if (!running) paintMesh();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    document.addEventListener("visibilitychange", onVisibility);
    if (lit) {
      card.addEventListener("pointermove", onPointerMove, { passive: true });
      card.addEventListener("pointerleave", onPointerLeave, { passive: true });
      card.addEventListener("pointerdown", onPointerDown, { passive: true });
    }

    resize();
    paintMesh();

    return () => {
      disposed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (lit) {
        card.removeEventListener("pointermove", onPointerMove);
        card.removeEventListener("pointerleave", onPointerLeave);
        card.removeEventListener("pointerdown", onPointerDown);
      }
      if (gl) {
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
      }
    };
  }, []);

  return (
    <div className="livingcard">
      <div className="livingcard-card" ref={cardRef}>
        <canvas className="livingcard-mesh" ref={meshRef} aria-hidden="true" />
        <div className="livingcard-veil" ref={veilRef} aria-hidden="true" />
        <div className="livingcard-glow" ref={glowRef} aria-hidden="true" />
        <div className="livingcard-content" ref={contentRef}>
          {children}
        </div>
        <div className="livingcard-sheen" ref={sheenRef} aria-hidden="true" />
      </div>
    </div>
  );
}