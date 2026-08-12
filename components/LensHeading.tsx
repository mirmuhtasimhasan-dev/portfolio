"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------
   §13b · The Projects heading, under glass.

   The words are drawn once into an offscreen 2D canvas and uploaded
   as a texture; a fragment shader magnifies them under the cursor and
   splits the channels at the rim. Nothing is composited behind them —
   the canvas clears to (0,0,0,0) and outputs premultiplied alpha — so
   the page's field shows through every transparent texel and the
   heading has no box around it.

   Alpha is the whole trick. Each of the three channel samples carries
   its own, the largest of them becomes the fragment's alpha, and the
   colour is assembled per channel from the three. Where only the red
   sample has landed on a glyph you get red at that texel's alpha and
   nothing else — a fringe that exists against any background, rather
   than a fringe painted onto an opaque rectangle.

   700, not 800: Instrument Sans's weight axis ends at 700 (see
   layout.tsx), and a synthesised heavier face smears once rasterised.
   ------------------------------------------------------------------ */

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_mouse;
uniform float u_aspect;

/* R is a fraction of the canvas HEIGHT — d.x is scaled by the aspect first,
   which makes the lens circular in pixels and makes this constant scale-free:
   canvas height and cap height both track the font size, so shrinking the
   heading does not move it.

   0.84 is a correction, not a rescale. The visible edge of the lens is not R
   but where the gaussian has fallen to 1/e, at R * sqrt(0.14) = 0.374 R. Cap
   height measures 0.72em against a 1.15 line box, so half of it is 0.313 of
   the canvas height, and 0.313 / 0.374 = 0.837. At the old 0.3 the visible
   lens was a third of that and read as a smudge rather than a lens. */
const float R = 0.84;

void main(){
  vec2 d = v_uv - u_mouse;
  d.x *= u_aspect;                      // circular in pixels, not in uv
  float dist = length(d);

  // under the lens the sample is pulled toward the cursor, which is what
  // magnifies; away from it mag returns to 1 and the text is untouched
  float mag = 1.0 - 0.42 * exp(-dist * dist / (R * R * 0.14));
  vec2 suv = u_mouse + (v_uv - u_mouse) * mag;

  float ab = 0.012 * exp(-dist * dist / (R * R * 0.2));
  vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0);

  // the split rides the magnified coordinate, or the two effects would
  // disagree about where the glyph is
  vec4 sr = texture2D(u_texture, suv + dir * ab);
  vec4 sg = texture2D(u_texture, suv);
  vec4 sb = texture2D(u_texture, suv - dir * ab);

  float alpha = max(max(sr.a, sg.a), sb.a);
  vec3 color = vec3(sr.r, sg.g, sb.b);

  gl_FragColor = vec4(color * alpha, alpha);
}
`;

/** The face the texture is drawn in — see the note above on 800. */
const WEIGHT = 700;
const INK = "#1a1a1a";
const EASE = 0.12;
/** where the lens parks once the pointer leaves: below the box, in uv */
const PARKED_Y = -0.8;

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

export default function LensHeading({ text }: { text: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const metricRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const metric = metricRef.current;
    const canvas = canvasRef.current;
    if (!root || !metric || !canvas) return;

    /* Any of these and the heading stays what it already is: real text, at
       the same size, styled by CSS. The canvas is never turned on. */
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const canHover = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    if (reduced || !canHover) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      }) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) return; // no WebGL: the plain h2 is already on screen

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTexture = gl.getUniformLocation(prog, "u_texture");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uAspect = gl.getUniformLocation(prog, "u_aspect");

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    /* The 2D canvas has y down and a texture's first row is t = 0, so
       without this the words upload upside down. */
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.uniform1i(uTexture, 0);

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const off = document.createElement("canvas");
    const ctx = off.getContext("2d");
    if (!ctx) return;

    let bufW = -1;
    let aspect = 1;

    /** Redraw the words and re-upload. Called on mount, on fonts, on resize. */
    function paintTexture() {
      if (!gl || !ctx || !metric || !canvas) return;
      const box = metric.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(box.width * dpr));
      const h = Math.max(1, Math.round(box.height * dpr));

      off.width = w;
      off.height = h;
      bufW = w;
      aspect = w / h;

      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);

      const cs = getComputedStyle(metric);
      const size = parseFloat(cs.fontSize) * dpr;

      ctx.clearRect(0, 0, w, h); // the ground stays fully transparent
      ctx.font = `${WEIGHT} ${size}px ${cs.fontFamily}`;
      ctx.fillStyle = INK;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      /* Room at the edges for the fringe to exist in — it reaches 0.012 of
         the width, and a glyph flush to the boundary would have its split
         clipped by CLAMP_TO_EDGE. */
      const pad = Math.round(w * 0.014);
      const room = w - pad * 2;
      const width = ctx.measureText(text).width;
      /* letterSpacing is not everywhere yet; compressing to fit is the
         fallback that cannot clip whatever the engine does with it. */
      const squeeze = width > room ? room / width : 1;

      ctx.save();
      ctx.translate(pad, h / 2);
      ctx.scale(squeeze, 1);
      ctx.fillText(text, 0, 0);
      ctx.restore();

      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      gl.uniform1f(uAspect, aspect);
    }

    /* ---- motion ------------------------------------------------------ */
    let tx = 0.5;
    let ty = PARKED_Y;
    let mx = 0.5;
    let my = PARKED_Y;

    let raf = 0;
    let running = false;
    let onScreen = false;
    let disposed = false;

    function draw() {
      if (!gl) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uMouse, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame() {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      mx += (tx - mx) * EASE;
      my += (ty - my) * EASE;
      draw();
    }

    function start() {
      if (running || disposed || !onScreen || document.hidden) return;
      if (bufW < 1) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function onMove(e: PointerEvent) {
      const r = canvas!.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      /* uv has y up, the pointer has y down */
      ty = 1 - (e.clientY - r.top) / r.height;
      start();
    }

    function onLeave() {
      ty = PARKED_Y; // drifts down and out rather than snapping away
      start();
    }

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(root);

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        paintTexture();
        if (!running) draw();
      }, 120);
    });
    ro.observe(metric);

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    root.dataset.on = "";
    paintTexture();
    draw();

    /* The words cannot be drawn in a face that has not arrived yet. */
    document.fonts?.ready.then(() => {
      if (disposed) return;
      paintTexture();
      if (!running) draw();
    });

    root.addEventListener("pointermove", onMove as EventListener, {
      passive: true,
    });
    root.addEventListener("pointerleave", onLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      window.clearTimeout(resizeTimer);
      root.removeEventListener("pointermove", onMove as EventListener);
      root.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      delete root.dataset.on;
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      off.width = off.height = 0;
    };
  }, [text]);

  return (
    <div className="lens" ref={rootRef}>
      {/* the real heading, and the only one anything is told about */}
      <h2 className="lens-title">{text}</h2>
      {/* holds the box open at the same size once the canvas takes over */}
      <span className="lens-metric" aria-hidden="true" ref={metricRef}>
        {text}
      </span>
      <canvas className="lens-canvas" ref={canvasRef} aria-hidden="true" />
    </div>
  );
}