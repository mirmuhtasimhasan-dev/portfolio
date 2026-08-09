"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------
   §2 · The fluid field.

   One fixed canvas behind the whole page. Metaballs in the palette,
   following the pointer, disturbed by a click. Drawn as a single
   full-screen triangle — cheaper than a quad, and free of the diagonal
   seam a two-triangle quad leaves in the derivative.
   ------------------------------------------------------------------ */

const VERT = `
attribute vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 u_res; uniform float u_t; uniform vec2 u_m; uniform float u_burst;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
float blob(vec2 p, vec2 c, float r){ float d = length(p-c); return r/(d*d+0.02); }

void main(){
  vec2 uv = gl_FragCoord.xy/u_res;
  vec2 p  = (gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec2 m  = (u_m-0.5*u_res)/u_res.y;
  float t = u_t*0.28;

  float f = 0.0;
  f += blob(p, vec2(sin(t*0.71)*0.62, cos(t*0.53)*0.34), 0.052);
  f += blob(p, vec2(cos(t*0.44)*0.74, sin(t*0.66)*0.40), 0.046);
  f += blob(p, vec2(sin(t*0.33+1.7)*0.48, cos(t*0.81+0.6)*0.46), 0.040);
  f += blob(p, vec2(cos(t*0.59+2.4)*0.86, sin(t*0.37+1.2)*0.28), 0.034);
  f += blob(p, m, 0.070 + u_burst*0.085);

  float ring = sin(length(p-m)*17.0 - u_t*3.4) * exp(-length(p-m)*3.0) * u_burst;
  f += ring*0.55;

  vec3 base  = vec3(0.961,0.953,0.937);
  vec3 mint  = vec3(0.639,0.886,0.816);
  vec3 lilac = vec3(0.706,0.667,0.945);
  vec3 peach = vec3(0.980,0.706,0.612);
  vec3 deep  = vec3(0.176,0.157,0.243);

  vec3 col = base;
  col = mix(col, mint,  smoothstep(0.55, 1.30, f));
  col = mix(col, lilac, smoothstep(1.15, 2.10, f));
  col = mix(col, peach, smoothstep(1.95, 3.10, f));
  col = mix(col, deep,  smoothstep(3.30, 5.20, f));

  float contour = smoothstep(0.46,0.5,fract(f*3.0)) * smoothstep(0.54,0.5,fract(f*3.0));
  col -= contour * 0.035;

  col += (hash(gl_FragCoord.xy + fract(u_t))-0.5)*0.026;
  col *= smoothstep(1.42, 0.34, length(uv-0.5)*1.30)*0.14 + 0.86;
  gl_FragColor = vec4(col,1.0);
}
`;

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
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

export default function FluidField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* No WebGL: the CSS gradient on .field stands in. Never an empty canvas. */
    const off = () => canvas.setAttribute("data-webgl", "off");

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = (canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: "low-power",
      }) ||
        canvas.getContext(
          "experimental-webgl",
        )) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) {
      off();
      return;
    }

    let prog: WebGLProgram | null = null;
    let buf: WebGLBuffer | null = null;
    let uRes: WebGLUniformLocation | null = null;
    let uT: WebGLUniformLocation | null = null;
    let uM: WebGLUniformLocation | null = null;
    let uBurst: WebGLUniformLocation | null = null;

    /* Everything the context owns, in one function, so it can be rebuilt
       after a context loss instead of leaving the page on the gradient. */
    function build(): boolean {
      if (!gl) return false;
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      prog = gl.createProgram();
      if (!vs || !fs || !prog) return false;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.useProgram(prog);

      /* one full-screen triangle */
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
      uM = gl.getUniformLocation(prog, "u_m");
      uBurst = gl.getUniformLocation(prog, "u_burst");
      return true;
    }

    if (!build()) {
      off();
      return;
    }

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    /* §9 — the field slows rather than stopping. */
    const timeScale = reduced ? 0.28 : 1;

    const DPR_CAP = 1.5;
    let quality = 1; // §8 adaptive resolution, 0.6 → 1
    let bufW = 1;
    let bufH = 1;
    let cssW = 1;
    let cssH = 1;

    /* pointer state, in drawing-buffer pixels */
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    let burst = 0;
    let pointerSeen = false;

    let t = 0;
    let last = 0;
    let raf = 0;
    let running = false;
    let dead = false;
    let contextLost = false;

    function resize() {
      if (!gl || !canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      cssW = Math.max(1, canvas.clientWidth);
      cssH = Math.max(1, canvas.clientHeight);
      const w = Math.max(1, Math.round(cssW * dpr * quality));
      const h = Math.max(1, Math.round(cssH * dpr * quality));
      if (w === bufW && h === bufH) return;
      bufW = w;
      bufH = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      if (!pointerSeen) {
        tx = mx = w * 0.5;
        ty = my = h * 0.62;
      }
    }

    function render() {
      if (!gl) return;
      gl.uniform2f(uRes, bufW, bufH);
      gl.uniform1f(uT, t);
      gl.uniform2f(uM, mx, my);
      gl.uniform1f(uBurst, burst);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* §8 — measure frame time, drop resolution when the GPU is behind. */
    let ema = 16.7;
    let settle = 0;

    function adapt(dt: number) {
      ema += (dt - ema) * 0.08;
      if (settle > 0) {
        settle -= 1;
        return;
      }
      const next =
        ema > 1000 / 44
          ? Math.max(0.6, quality - 0.2)
          : ema < 1000 / 56
            ? Math.min(1, quality + 0.2)
            : quality;
      if (next !== quality) {
        quality = next;
        settle = 45;
        ema = 16.7;
        resize();
        /* resize() reallocates the drawing buffer, and adapt() runs after
           render(), so without this the frame ends with an empty buffer — and
           an alpha:false canvas composites that as a black rectangle. Same
           hazard as resizing while parked, one frame instead of many. */
        render();
      }
    }

    function frame(now: number) {
      if (dead || contextLost) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(50, now - last);
      last = now;

      t += (dt / 1000) * timeScale;

      /* damp the pointer and the burst, frame-rate independently */
      const k = 1 - Math.pow(1 - 0.12, (dt / 1000) * 60);
      mx += (tx - mx) * k;
      my += (ty - my) * k;
      burst *= Math.pow(0.945, (dt / 1000) * 60);
      if (burst < 0.0015) burst = 0;

      render();
      adapt(dt);
    }

    function start() {
      if (running || dead || contextLost) return;
      running = true;
      last = performance.now(); // §8 — reset the delta clock on resume
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    /* §2 — listen on window. Panels sit on top and swallow every move. */
    function onMove(e: PointerEvent) {
      pointerSeen = true;
      const sx = bufW / cssW;
      const sy = bufH / cssH;
      tx = e.clientX * sx;
      ty = (cssH - e.clientY) * sy;
    }

    function onDown() {
      burst = 1;
    }

    function onResize() {
      resize();
      if (!running && !contextLost) render(); // §8 — repaint by hand while parked
    }

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    /* A lost context is normal on a phone — a driver reset, a GPU process
       restart, a backgrounded tab. Fall back to the gradient while it is
       gone, then rebuild rather than staying degraded for the session. */
    function onLost(e: Event) {
      e.preventDefault();
      contextLost = true;
      stop();
      off();
    }

    function onRestored() {
      if (dead) return;
      if (!build()) return;
      contextLost = false;
      canvas?.removeAttribute("data-webgl");
      bufW = bufH = -1; // force a fresh drawing buffer + viewport
      resize();
      render();
      if (!document.hidden) start();
    }

    resize();
    render(); // paint once before the loop so nothing composites black

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    if (!document.hidden) start();

    return () => {
      dead = true;
      stop();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, []);

  return (
    <div className="field" aria-hidden="true">
      <canvas ref={canvasRef} className="field-canvas" />
    </div>
  );
}