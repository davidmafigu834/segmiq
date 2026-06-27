"use client";

/**
 * ServiceNowBackground — a ServiceNow-style animated hero backdrop rendered with WebGL (three.js).
 *
 * It layers three effects into one GPU scene:
 *   1. Flowing/liquid gradient   — FBM noise driven by time, in the Segmiq dark + lime palette.
 *   2. Topographic contour lines — banded noise (the "wavy map" look) drawn over the gradient.
 *   3. Floating particles        — a parallax point field that drifts and reacts to the pointer.
 *
 * Notes:
 *   - Pure three.js (no react-three-fiber) so it is fully self-contained and SSR-safe.
 *   - Respects prefers-reduced-motion (freezes animation, renders a single static frame).
 *   - Pauses when the tab is hidden and when scrolled out of view to save battery/GPU.
 *   - Caps device pixel ratio at 2 for performance.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  className?: string;
  /** 0..1 overall intensity of the motion/brightness. Default 1. */
  intensity?: number;
  /**
   * When true, the scene evolves with page scroll progress (palette shifts +
   * the pattern morphs section to section). Use for a fixed full-page backdrop.
   */
  scrollDriven?: boolean;
};

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec2  uMouse;
  uniform float uIntensity;
  uniform float uScroll; // 0..1 progress through the whole page

  // --- value noise + fbm ---------------------------------------------------
  vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = dot(hash22(i + vec2(0.0, 0.0)) - 0.5, f - vec2(0.0, 0.0));
    float b = dot(hash22(i + vec2(1.0, 0.0)) - 0.5, f - vec2(1.0, 0.0));
    float c = dot(hash22(i + vec2(0.0, 1.0)) - 0.5, f - vec2(0.0, 1.0));
    float d = dot(hash22(i + vec2(1.0, 1.0)) - 0.5, f - vec2(1.0, 1.0));
    return 0.5 + mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 6; i++) {
      v += amp * noise(p);
      p = rot * p * 2.0 + 17.0;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    // aspect-correct coordinates
    vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;

    float s = clamp(uScroll, 0.0, 1.0);

    // motion speeds up slightly and the field drifts as you scroll → the
    // pattern visibly morphs from section to section ("live" background).
    float t = uTime * (0.06 + 0.05 * s) * uIntensity;
    vec2 scrollDrift = vec2(s * 2.6, s * -3.4);

    // domain-warped fbm for the organic flowing motion
    vec2 q = vec2(fbm(p * 1.6 + scrollDrift + vec2(0.0, t)), fbm(p * 1.6 + scrollDrift + vec2(5.2, -t)));
    vec2 warp = p * 2.0 + 1.4 * q + 0.25 * uMouse + scrollDrift;
    float n = fbm(warp + t);

    // --- palette evolves across the page ----------------------------------
    vec3 cBlack = vec3(0.039, 0.039, 0.039); // #0A0A0A
    vec3 cLime  = vec3(0.831, 1.000, 0.310); // #D4FF4F accent (constant)

    // mid + deep tones travel: lime/teal (top) → indigo (mid) → violet/teal (bottom)
    vec3 deepA = vec3(0.024, 0.090, 0.078); // dark teal
    vec3 deepB = vec3(0.035, 0.045, 0.110); // deep indigo
    vec3 deepC = vec3(0.070, 0.030, 0.095); // deep violet
    vec3 cDeep = mix(deepA, deepB, smoothstep(0.0, 0.55, s));
    cDeep      = mix(cDeep, deepC, smoothstep(0.55, 1.0, s));

    vec3 toneA = vec3(0.043, 0.345, 0.282); // teal/green
    vec3 toneB = vec3(0.090, 0.180, 0.470); // electric blue
    vec3 toneC = vec3(0.290, 0.140, 0.430); // purple
    vec3 cTone = mix(toneA, toneB, smoothstep(0.0, 0.55, s));
    cTone      = mix(cTone, toneC, smoothstep(0.55, 1.0, s));

    vec3 col = mix(cBlack, cDeep, smoothstep(0.25, 0.6, n));
    col = mix(col, cTone, smoothstep(0.55, 0.85, n) * 0.7);
    col = mix(col, cLime, smoothstep(0.82, 0.97, n) * 0.18);

    // --- topographic contour lines (denser deeper down the page) -----------
    float bands = n * (8.0 + 5.0 * s);
    float edge = fract(bands);
    float line = smoothstep(0.0, 0.04, edge) * (1.0 - smoothstep(0.06, 0.12, edge));
    float contourGlow = line * (0.10 + 0.10 * smoothstep(0.5, 1.0, n));
    col += mix(cLime, cTone + 0.3, s) * contourGlow;

    // --- subtle vignette so the hero copy stays readable ------------------
    float d = length(uv - vec2(0.5, 0.46));
    float vign = smoothstep(0.95, 0.25, d);
    col *= mix(0.35, 1.0, vign);

    // gentle top-to-bottom darkening to blend into the page below
    col *= mix(1.0, 0.55, smoothstep(0.35, 1.0, uv.y));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function ServiceNowBackground({ className, intensity = 1, scrollDriven = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // --- full-screen shader quad (gradient + contours) ---------------------
    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uIntensity: { value: intensity },
      uScroll: { value: 0 },
    };
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, depthTest: false, depthWrite: false })
    );
    scene.add(quad);

    // --- particle field ----------------------------------------------------
    const COUNT = 220;
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() * 2 - 1); // x in clip space
      positions[i * 3 + 1] = (Math.random() * 2 - 1); // y in clip space
      positions[i * 3 + 2] = 0;
      speeds[i] = 0.02 + Math.random() * 0.06;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xd4ff4f,
      size: 2.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    // --- sizing ------------------------------------------------------------
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // --- pointer parallax --------------------------------------------------
    const targetMouse = new THREE.Vector2(0, 0);
    const onPointer = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      targetMouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // --- scroll progress (drives the evolving palette/pattern) -------------
    let targetScroll = 0;
    let staticRender = false; // true in reduced-motion to repaint on scroll
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      targetScroll = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
      if (staticRender) {
        uniforms.uScroll.value = targetScroll;
        renderer.render(scene, camera);
      }
    };
    if (scrollDriven) {
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    // --- visibility / in-view gating ---------------------------------------
    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 });
    io.observe(container);
    const onVis = () => { visible = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);

    // --- render loop -------------------------------------------------------
    const clock = new THREE.Clock();
    let raf = 0;
    const renderOnce = () => {
      uniforms.uMouse.value.lerp(targetMouse, 0.05);
      uniforms.uScroll.value += (targetScroll - uniforms.uScroll.value) * 0.06;
      // drift particles upward with a slight horizontal sway, wrap around
      const pos = pGeo.attributes.position as THREE.BufferAttribute;
      const tNow = uniforms.uTime.value;
      for (let i = 0; i < COUNT; i++) {
        let y = pos.getY(i) + speeds[i] * 0.01;
        if (y > 1.05) y = -1.05;
        const x = pos.getX(i) + Math.sin(tNow * 0.5 + i) * 0.0004 + uniforms.uMouse.value.x * 0.0006;
        pos.setX(i, x);
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      renderer.render(scene, camera);
    };

    if (reduceMotion) {
      uniforms.uTime.value = 12.0; // a pleasant static frame
      uniforms.uScroll.value = targetScroll;
      staticRender = scrollDriven; // palette still shifts on scroll, no motion
      renderOnce();
    } else {
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!visible) return;
        uniforms.uTime.value += clock.getDelta();
        renderOnce();
      };
      raf = requestAnimationFrame(loop);
    }

    // --- cleanup -----------------------------------------------------------
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
      quad.geometry.dispose();
      (quad.material as THREE.Material).dispose();
      pGeo.dispose();
      pMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [intensity, scrollDriven]);

  return <div ref={containerRef} aria-hidden className={className} />;
}
