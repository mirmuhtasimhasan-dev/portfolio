"use client";

import { useEffect, useRef } from "react";
import { content } from "@/lib/content";
import PillNav from "./PillNav";

/* ------------------------------------------------------------------
   §5 · The About Me device.

   A laptop-style screen holding a screenshot. Tilted back at the top of
   the section, upright by the bottom. Two triangles drawn twice per
   frame — the reflection first, then the device.
   ------------------------------------------------------------------ */

const VERT = `
attribute vec2 a_pos;
attribute vec2 a_uv;
uniform float u_rotX, u_scale, u_aspect, u_yOff, u_mirror;
varying vec2 v_uv;

void main(){
  vec3 p = vec3(a_pos * u_scale, 0.0);

  // hinge at the bottom edge so it opens like a lid, not a card spinning
  p.y += 0.5 * u_scale;
  float c = cos(u_rotX), s = sin(u_rotX);
  p = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  p.y -= 0.5 * u_scale;

  if(u_mirror > 0.5){ p.y = -p.y - 1.06 * u_scale; }
  p.y += u_yOff;

  float d = 3.0;
  float w = 1.0 - p.z / d;
  v_uv = a_uv;
  gl_Position = vec4(p.x / u_aspect, p.y, 0.0, w);
}
`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_rotX, u_mirror;
uniform vec3 u_accent, u_bg;

float rrect(vec2 uv, vec2 half_, float r){
  vec2 p = abs(uv - 0.5) - (half_ - r);
  return length(max(p, 0.0)) - r;
}

void main(){
  float aa = 0.0035;

  float body = rrect(v_uv, vec2(0.5, 0.5), 0.028);
  float bodyMask = smoothstep(aa, -aa, body);
  if(bodyMask < 0.001) discard;

  float scr = rrect(v_uv, vec2(0.478, 0.470), 0.020);
  float scrMask = smoothstep(aa, -aa, scr);

  vec2 suv = (v_uv - 0.5) / vec2(0.956, 0.940) + 0.5;
  vec3 shot = texture2D(u_tex, suv).rgb;

  vec3 bezel = mix(u_bg * 0.55, u_bg * 0.95, smoothstep(0.0, 1.0, v_uv.y));
  vec3 col = mix(bezel, shot, scrMask);

  // specular sweep — travels as the lid rotates
  float band = v_uv.x * 0.8 + v_uv.y * 0.6;
  float sweep = smoothstep(0.22, 0.0, abs(band - (0.35 + u_rotX * 0.75)));
  col += vec3(0.85, 0.90, 1.0) * sweep * 0.13 * (0.35 + u_rotX);

  col *= 1.0 - u_rotX * 0.22;                       // darkens as it leans away

  float rim = smoothstep(0.012, 0.0, abs(body)) * (1.0 - scrMask);
  col += u_accent * rim * 0.55;                      // accent on the bezel edge

  float alpha = bodyMask;

  if(u_mirror > 0.5){
    float fade = smoothstep(0.0, 0.85, v_uv.y);
    col = mix(u_bg, col, 0.30);
    alpha *= fade * 0.30;
  }

  gl_FragColor = vec4(col, alpha);
}
`;

/* §5 geometry — 16:10, UVs with v = 0 at the top edge. */
const POS = new Float32Array([
  -0.8, -0.5, 0.8, -0.5, 0.8, 0.5, -0.8, -0.5, 0.8, 0.5, -0.8, 0.5,
]);
const UV = new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]);

/** §8 — smootherstep: zeroes the second derivative as well as the first. */
function smootherstep(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * c * (c * (6 * c - 15) + 10);
}

function readColor(name: string, fallback: [number, number, number]) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (!m) return fallback;
  let hex = m[1];
  if (hex.length === 3)
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const n = parseInt(hex, 16);
  return [
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  ] as [number, number, number];
}

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

export default function TiltShowcase() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const nav = navRef.current;
    if (!root || !stage || !canvas || !img || !nav) return;

    let teardown: (() => void) | null = null;
    let cancelled = false;

    function boot() {
      if (cancelled || !root || !stage || !canvas || !img || !nav) return;
      if (!img.naturalWidth) return; // image failed — stay on the fallback

      let gl: WebGLRenderingContext | null = null;
      try {
        gl = canvas.getContext("webgl", {
          alpha: true,
          premultipliedAlpha: false,
          antialias: true,
          depth: false,
          stencil: false,
          powerPreference: "low-power",
        }) as WebGLRenderingContext | null;
      } catch {
        gl = null;
      }
      if (!gl) return; // §9 — the <img> fallback is already on screen

      let prog: WebGLProgram | null = null;
      let posBuf: WebGLBuffer | null = null;
      let uvBuf: WebGLBuffer | null = null;
      let tex: WebGLTexture | null = null;
      let uRotX: WebGLUniformLocation | null = null;
      let uScale: WebGLUniformLocation | null = null;
      let uAspect: WebGLUniformLocation | null = null;
      let uYOff: WebGLUniformLocation | null = null;
      let uMirror: WebGLUniformLocation | null = null;

      /* Everything the context owns — including the texture — in one place,
         so a lost context can be rebuilt rather than dropping the page back
         to the <img> for the rest of the session. */
      function build(): boolean {
        if (!gl || !img) return false;
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

        posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, POS, gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(prog, "a_pos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        uvBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, UV, gl.STATIC_DRAW);
        const aUv = gl.getAttribLocation(prog, "a_uv");
        gl.enableVertexAttribArray(aUv);
        gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

        /* §6.1 — generateMipmap refuses a non-power-of-two texture in WebGL1
           and leaves it incomplete, which samples black. Square the shot into
           2048×2048 first; the quad's 0–1 UVs undo the squash exactly. */
        const SQ = 2048;
        const scratch = document.createElement("canvas");
        scratch.width = SQ;
        scratch.height = SQ;
        const sctx = scratch.getContext("2d");
        if (!sctx) return false;
        sctx.drawImage(img, 0, 0, SQ, SQ);

        tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        /* §6.2 — do NOT set UNPACK_FLIP_Y_WEBGL. The UVs already put v = 0 at
           the top edge, which is the image's own origin. */
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          scratch,
        );
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.LINEAR_MIPMAP_LINEAR,
        );
        scratch.width = scratch.height = 0;

        uRotX = gl.getUniformLocation(prog, "u_rotX");
        uScale = gl.getUniformLocation(prog, "u_scale");
        uAspect = gl.getUniformLocation(prog, "u_aspect");
        uYOff = gl.getUniformLocation(prog, "u_yOff");
        uMirror = gl.getUniformLocation(prog, "u_mirror");

        const accent = readColor("--mint", [0.639, 0.886, 0.816]);
        const bg = readColor("--paper", [0.961, 0.953, 0.937]);
        gl.uniform1i(gl.getUniformLocation(prog, "u_tex"), 0);
        gl.uniform3f(
          gl.getUniformLocation(prog, "u_accent"),
          accent[0],
          accent[1],
          accent[2],
        );
        gl.uniform3f(gl.getUniformLocation(prog, "u_bg"), bg[0], bg[1], bg[2]);

        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);
        return true;
      }

      if (!build()) return; // §9 — the <img> fallback is already on screen

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const narrow = window.matchMedia("(max-width: 720px)").matches;
      const REST_ROT = narrow ? 0.45 : 0.62;

      const DPR_CAP = 2;
      let quality = 1;
      let bufW = 1;
      let bufH = 1;
      let aspect = 1;
      let fit = 1;

      /* current values, damped toward their targets */
      let rotX = reduced ? 0 : REST_ROT;
      let scale = reduced ? 1 : 0.82;
      let yOff = reduced ? 0 : -0.1;
      let navOpacity = reduced ? 1 : 0;

      let last = 0;
      let raf = 0;
      let running = false;
      let onScreen = false;
      let disposed = false;
      let contextLost = false;
      let lastEdge = -9999;
      let lastOpacity = -1;

      function resize() {
        if (!gl || !canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        const cw = Math.max(1, canvas.clientWidth);
        const ch = Math.max(1, canvas.clientHeight);
        aspect = cw / ch;
        /* §6.3 — p.x / u_aspect only keeps things on screen while the frame
           is wider than it is tall. Fit to whichever axis is tighter: the
           aspect term is the width limit, the cap is the height limit.
           1.68 puts the device at 84% of the stage height on a landscape
           viewport — the 16% left over is what keeps the pill navbar, which
           straddles the top edge, from being clipped by the stage. At 360×780
           the width term binds instead and gives 0.54. */
        fit = Math.min(1.68, (0.94 * aspect) / 0.8);
        const w = Math.max(1, Math.round(cw * dpr * quality));
        const h = Math.max(1, Math.round(ch * dpr * quality));
        if (w === bufW && h === bufH) return;
        bufW = w;
        bufH = h;
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      function progress() {
        if (!root) return 0;
        const rect = root.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        if (travel <= 0) return 1;
        const p = -rect.top / travel;
        return p < 0 ? 0 : p > 1 ? 1 : p;
      }

      let draws = 0;

      function draw() {
        if (!gl) return;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uRotX, rotX);
        gl.uniform1f(uScale, scale * fit);
        gl.uniform1f(uAspect, aspect);
        gl.uniform1f(uYOff, yOff);

        gl.uniform1f(uMirror, 1); // reflection first…
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.uniform1f(uMirror, 0); // …then the device
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        draws += 2;
        if (process.env.NODE_ENV !== "production") {
          (window as unknown as Record<string, number>).__deviceDraws = draws;
        }
      }

      /* §5 — hold the pill navbar on the device's projected top edge, run
         through the same transform the vertex shader uses. */
      function placeNav() {
        if (!nav || !stage) return;
        const s = scale * fit;
        const y = s * Math.cos(rotX) - 0.5 * s + yOff;
        const z = s * Math.sin(rotX);
        const topPercent = ((1 - y / (1 - z / 3)) / 2) * 100;
        const px = Math.round((topPercent / 100) * stage.clientHeight * 2) / 2;
        if (px !== lastEdge) {
          lastEdge = px;
          nav.style.setProperty("--edge-y", String(px));
        }
        /* quantised — a fresh fractional value every frame is its own churn */
        const o = Math.round(navOpacity * 50) / 50;
        if (o !== lastOpacity) {
          lastOpacity = o;
          nav.style.opacity = String(o);
          nav.style.pointerEvents = o < 0.05 ? "none" : "";
        }
      }

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
        }
      }

      function frame(now: number) {
        if (disposed || contextLost) return;
        raf = requestAnimationFrame(frame);
        const dt = Math.min(50, now - last);
        last = now;

        const p = progress();
        const e = 1 - Math.pow(1 - p, 3);

        const tRot = REST_ROT * (1 - e);
        const tScale = 0.82 + 0.18 * e;
        const tYOff = -0.1 * (1 - e);
        /* smootherstep, not smoothstep — no kick as the label arrives */
        const tNav = smootherstep(p * 6) * smootherstep((1 - p) * 6);

        /* 0.10 per frame at 60fps, applied frame-rate independently */
        const k = 1 - Math.pow(0.9, (dt / 1000) * 60);
        rotX += (tRot - rotX) * k;
        scale += (tScale - scale) * k;
        yOff += (tYOff - yOff) * k;
        navOpacity += (tNav - navOpacity) * k;

        draw();
        placeNav();
        adapt(dt);
      }

      function start() {
        if (running || disposed || contextLost) return;
        if (!onScreen || document.hidden) return;
        running = true;
        last = performance.now(); // §8 — reset the delta clock on resume
        raf = requestAnimationFrame(frame);
      }

      function stop() {
        running = false;
        cancelAnimationFrame(raf);
      }

      function paintOnce() {
        const p = progress();
        const e = 1 - Math.pow(1 - p, 3);
        rotX = REST_ROT * (1 - e);
        scale = 0.82 + 0.18 * e;
        yOff = -0.1 * (1 - e);
        navOpacity = smootherstep(p * 6) * smootherstep((1 - p) * 6);
        draw();
        placeNav();
      }

      resize();
      if (reduced) {
        /* §9 — renders once, upright, and stays there */
        rotX = 0;
        scale = 1;
        yOff = 0;
        navOpacity = 1;
        draw();
        placeNav();
      } else {
        paintOnce();
      }

      canvas.setAttribute("data-webgl", "on");
      stage.setAttribute("data-mode", "gl");

      const io = new IntersectionObserver(
        (entries) => {
          onScreen = entries[0].isIntersecting;
          if (reduced) return;
          if (onScreen) start();
          else stop();
        },
        { threshold: 0 },
      );
      io.observe(root);

      function onVisibility() {
        if (reduced) return;
        if (document.hidden) stop();
        else start();
      }

      function onResize() {
        resize();
        /* §8 — repaint by hand while parked, or the cleared drawing buffer
           composites as a black rectangle. */
        if (!running && !contextLost) paintOnce();
      }

      /* A lost context is normal on a phone. Show the <img> while it is gone,
         then rebuild — including the texture — rather than staying degraded. */
      function onLost(ev: Event) {
        ev.preventDefault();
        contextLost = true;
        stop();
        canvas?.removeAttribute("data-webgl");
        stage?.removeAttribute("data-mode");
      }

      function onRestored() {
        if (disposed) return;
        if (!build()) return;
        contextLost = false;
        bufW = bufH = -1; // force a fresh drawing buffer + viewport
        resize();
        if (reduced) {
          rotX = 0;
          scale = 1;
          yOff = 0;
          navOpacity = 1;
          draw();
          placeNav();
        } else {
          paintOnce();
        }
        canvas?.setAttribute("data-webgl", "on");
        stage?.setAttribute("data-mode", "gl");
        if (!reduced) start();
      }

      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("resize", onResize);
      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);

      teardown = () => {
        disposed = true;
        stop();
        io.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        gl?.deleteTexture(tex);
        gl?.deleteBuffer(posBuf);
        gl?.deleteBuffer(uvBuf);
        gl?.deleteProgram(prog);
      };
    }

    if (img.complete) boot();
    else img.addEventListener("load", boot, { once: true });

    return () => {
      cancelled = true;
      img.removeEventListener("load", boot);
      teardown?.();
    };
  }, []);

  const shot = content.about.shot;

  return (
    <div className="showcase" ref={rootRef}>
      <div className="showcase-stage" ref={stageRef}>
        {/* §9 — the screenshot is the no-WebGL, no-JS state, and it is also
            the texture source, so the device costs exactly one fetch.
            alt="" because it is a picture of the About copy, and that copy is
            real text in this same section — describing it again would just
            read the section twice. */}
        <div className="showcase-fallback">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={shot.src}
            alt=""
            width={shot.width}
            height={shot.height}
            decoding="async"
            loading="lazy"
          />
        </div>
        <canvas className="showcase-canvas" ref={canvasRef} aria-hidden="true" />
        <div className="nav-floating" ref={navRef}>
          <PillNav decorative />
        </div>
      </div>
    </div>
  );
}