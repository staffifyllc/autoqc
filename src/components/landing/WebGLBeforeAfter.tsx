"use client";

import { useEffect, useRef, useState } from "react";
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from "ogl";

// Lusion-style before/after: a fragment shader physically warps and
// color-shifts the BEFORE image into the AFTER image as the user drags
// (or scrolls within the section). Mouse position drives a soft chromatic
// distortion that ripples around the cursor — small, tasteful, expensive-
// looking. The split is a vertical line that lerps to the cursor.
//
// Falls back to a static image pair if WebGL is unavailable.

type Props = {
  beforeSrc: string;
  afterSrc: string;
  className?: string;
  // Optional descriptive labels rendered as small mono pills in the corners.
  beforeLabel?: string;
  afterLabel?: string;
};

const VERT = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D uBefore;
uniform sampler2D uAfter;
uniform vec2 uMouse;       // 0..1 in canvas space
uniform float uSplit;      // 0..1, where the split line sits (eased to mouse.x)
uniform float uTime;
uniform float uHover;      // 0..1 hover intensity

varying vec2 vUv;

// Soft chromatic-aberration / lens-warp around the mouse, intensity
// proportional to distance from the split line. Looks like the photo
// is physically being "edited" as you drag.
vec4 sampleWarped(sampler2D tex, vec2 uv, float strength) {
  vec2 toMouse = uv - uMouse;
  float dist = length(toMouse);
  float warp = smoothstep(0.35, 0.0, dist) * strength;
  vec2 dir = normalize(toMouse + vec2(0.0001));
  // RGB split — small offsets per channel near the cursor for a wet,
  // optical feel.
  float r = texture2D(tex, uv - dir * warp * 0.012).r;
  float g = texture2D(tex, uv - dir * warp * 0.006).g;
  float b = texture2D(tex, uv).b;
  float a = texture2D(tex, uv).a;
  return vec4(r, g, b, a);
}

void main() {
  vec2 uv = vUv;

  // Distance from the vertical split line (in 0..1 space).
  float distFromSplit = abs(uv.x - uSplit);

  // Strength of the warp: peaks right at the split, fades within ~12% of
  // canvas width on either side.
  float edge = 1.0 - smoothstep(0.0, 0.12, distFromSplit);
  float warpStrength = edge * (0.6 + uHover * 0.6);

  vec4 before = sampleWarped(uBefore, uv, warpStrength);
  vec4 after  = sampleWarped(uAfter, uv, warpStrength);

  // The split itself: pick before on the left, after on the right, with
  // a soft ~1.5px feather so it doesn't aliase.
  float k = smoothstep(uSplit - 0.0015, uSplit + 0.0015, uv.x);
  vec3 col = mix(before.rgb, after.rgb, k);

  // Glowing seam line right at the split — subtle green, scaled by hover.
  float seam = smoothstep(0.004, 0.0, distFromSplit);
  vec3 glow = vec3(0.33, 0.94, 0.6);
  col += glow * seam * (0.18 + uHover * 0.45);

  gl_FragColor = vec4(col, 1.0);
}
`;

function loadTexture(gl: any, src: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const tex = new Texture(gl, { generateMipmaps: false });
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      tex.image = img;
      resolve(tex);
    };
    img.onerror = reject;
    img.src = src;
  });
}

export function WebGLBeforeAfter({
  beforeSrc,
  afterSrc,
  className = "",
  beforeLabel = "Raw upload",
  afterLabel = "AutoQC output",
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [supported, setSupported] = useState<boolean>(true);
  const [ready, setReady] = useState(false);

  // Mouse tracking — world coords + smoothed split position.
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const splitRef = useRef(0.5);
  const hoverRef = useRef(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let disposed = false;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        canvas,
        alpha: false,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    } catch (e) {
      setSupported(false);
      return;
    }
    const gl = renderer.gl;
    gl.clearColor(0.04, 0.05, 0.06, 1);

    const camera = new Camera(gl);
    const scene = new Transform();
    const geometry = new Plane(gl, { width: 2, height: 2 });

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uBefore: { value: new Texture(gl) },
        uAfter: { value: new Texture(gl) },
        uMouse: { value: [0.5, 0.5] },
        uSplit: { value: 0.5 },
        uTime: { value: 0 },
        uHover: { value: 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });
    mesh.setParent(scene);

    function resize() {
      const w = wrap!.clientWidth;
      const h = wrap!.clientHeight;
      renderer.setSize(w, h);
      camera.perspective({ aspect: w / h });
    }
    resize();
    window.addEventListener("resize", resize);

    Promise.all([
      loadTexture(gl as any, beforeSrc),
      loadTexture(gl as any, afterSrc),
    ])
      .then(([t1, t2]) => {
        if (disposed) return;
        program.uniforms.uBefore.value = t1;
        program.uniforms.uAfter.value = t2;
        setReady(true);
      })
      .catch(() => setSupported(false));

    let raf: number;
    let start = performance.now();
    function tick(now: number) {
      const t = (now - start) / 1000;
      // Smoothly lerp the split toward the mouse x.
      splitRef.current += (mouseRef.current.x - splitRef.current) * 0.08;
      program.uniforms.uMouse.value = [mouseRef.current.x, mouseRef.current.y];
      program.uniforms.uSplit.value = splitRef.current;
      program.uniforms.uTime.value = t;
      program.uniforms.uHover.value = hoverRef.current;
      renderer.render({ scene, camera });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    function onPointerMove(e: PointerEvent) {
      const rect = wrap!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      mouseRef.current.x = Math.max(0, Math.min(1, x));
      mouseRef.current.y = Math.max(0, Math.min(1, y));
    }
    function onEnter() {
      hoverRef.current = 1;
    }
    function onLeave() {
      hoverRef.current = 0;
      // Park the split back at center on leave so the section feels alive
      // even when the cursor is elsewhere.
      mouseRef.current.x = 0.5;
    }
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerenter", onEnter);
    wrap.addEventListener("pointerleave", onLeave);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerenter", onEnter);
      wrap.removeEventListener("pointerleave", onLeave);
    };
  }, [beforeSrc, afterSrc]);

  if (!supported) {
    // Fallback: native side-by-side via a CSS clip slider, no WebGL.
    return (
      <div
        ref={wrapRef}
        className={`relative overflow-hidden ${className}`}
        data-cursor="scan"
      >
        {/* eslint-disable @next/next/no-img-element */}
        <img src={afterSrc} alt={afterLabel} className="absolute inset-0 w-full h-full object-cover" />
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ clipPath: "inset(0 50% 0 0)" }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#55f19a] shadow-[0_0_24px_rgba(85,241,154,0.6)]" />
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden ${className}`}
      data-cursor="scan"
    >
      <canvas
        ref={canvasRef}
        className={`block w-full h-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {/* Corner labels */}
      <div className="pointer-events-none absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-mono uppercase tracking-wider text-white/80">
        {beforeLabel}
      </div>
      <div className="pointer-events-none absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#55f19a]/15 backdrop-blur-sm border border-[#55f19a]/40 text-[10px] font-mono uppercase tracking-wider text-[#55f19a]">
        {afterLabel}
      </div>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#55f19a]">
            Initializing shader…
          </div>
        </div>
      )}
    </div>
  );
}
