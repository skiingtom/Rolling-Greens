import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/**
 * Kuwahara filter: picks the calmest of four quadrants around each pixel,
 * flattening detail into soft, blocky dabs of paint while keeping edges.
 */
const KUWAHARA_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float spread;
varying vec2 vUv;

#define R 4

void main() {
  vec2 px = spread / resolution;
  vec3 m0 = vec3(0.0); vec3 m1 = vec3(0.0); vec3 m2 = vec3(0.0); vec3 m3 = vec3(0.0);
  vec3 s0 = vec3(0.0); vec3 s1 = vec3(0.0); vec3 s2 = vec3(0.0); vec3 s3 = vec3(0.0);
  vec3 c;
  for (int j = 0; j <= R; j++) {
    for (int i = 0; i <= R; i++) {
      c = texture2D(tDiffuse, vUv + vec2(-float(i), -float(j)) * px).rgb; m0 += c; s0 += c * c;
      c = texture2D(tDiffuse, vUv + vec2( float(i), -float(j)) * px).rgb; m1 += c; s1 += c * c;
      c = texture2D(tDiffuse, vUv + vec2( float(i),  float(j)) * px).rgb; m2 += c; s2 += c * c;
      c = texture2D(tDiffuse, vUv + vec2(-float(i),  float(j)) * px).rgb; m3 += c; s3 += c * c;
    }
  }
  float n = float((R + 1) * (R + 1));
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  vec3 v0 = abs(s0 / n - m0 * m0);
  vec3 v1 = abs(s1 / n - m1 * m1);
  vec3 v2 = abs(s2 / n - m2 * m2);
  vec3 v3 = abs(s3 / n - m3 * m3);
  float e0 = v0.r + v0.g + v0.b;
  float e1 = v1.r + v1.g + v1.b;
  float e2 = v2.r + v2.g + v2.b;
  float e3 = v3.r + v3.g + v3.b;

  // Soft-weighted blend instead of a hard pick: smoother, more brush-like
  float w0 = 1.0 / (1e-6 + e0 * e0);
  float w1 = 1.0 / (1e-6 + e1 * e1);
  float w2 = 1.0 / (1e-6 + e2 * e2);
  float w3 = 1.0 / (1e-6 + e3 * e3);
  vec3 col = (m0 * w0 + m1 * w1 + m2 * w2 + m3 * w3) / (w0 + w1 + w2 + w3);
  gl_FragColor = vec4(col, 1.0);
}
`

/**
 * Canvas finish: wobbling brush displacement, directional stroke streaks,
 * linen weave, a muted gallery grade, and a soft vignette.
 */
const FINISH_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float pixelRatio;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += noise(p) * a; p *= 2.07; a *= 0.5; }
  return v;
}

void main() {
  vec2 frag = vUv * resolution / pixelRatio;

  // Brush wobble — nudges edges so nothing is ruler-straight
  vec2 warp = vec2(fbm(frag / 70.0), fbm(frag / 70.0 + 19.7)) - 0.5;
  vec2 fine = vec2(noise(frag / 6.0), noise(frag / 6.0 + 4.1)) - 0.5;
  vec2 uv = vUv + (warp * 5.0 + fine * 1.4) * pixelRatio / resolution;
  vec3 col = texture2D(tDiffuse, uv).rgb;

  // Gallery grade: slightly desaturated, cool shadows, warm creamy lights
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 0.9);
  col = mix(col, col * vec3(0.82, 0.93, 1.06) + vec3(0.0, 0.01, 0.03), smoothstep(0.42, 0.0, l) * 0.7);
  col += vec3(0.035, 0.028, 0.0) * smoothstep(0.55, 1.0, l);

  // Directional stroke streaks at two angles
  vec2 a = mat2(0.86, -0.5, 0.5, 0.86) * frag;
  vec2 b = mat2(0.5, 0.86, -0.86, 0.5) * frag;
  float s1 = noise(vec2(a.x / 3.0, a.y / 26.0));
  float s2 = noise(vec2(b.x / 3.0, b.y / 22.0));
  float pick = smoothstep(0.35, 0.65, fbm(frag / 120.0));
  float streak = mix(s1, s2, pick);
  col *= 0.955 + 0.09 * streak;

  // Linen canvas weave
  float wx = sin(frag.x * 1.9 + noise(frag * 0.08) * 2.0);
  float wy = sin(frag.y * 1.9 + noise(frag.yx * 0.08) * 2.0);
  float weave = 0.5 + 0.25 * (wx + wy);
  col *= 0.975 + 0.05 * weave;

  // Pigment grain
  col += (hash(frag + fract(l)) - 0.5) * 0.02;

  // Soft vignette, like light falling off across a canvas
  vec2 d = vUv - 0.5;
  col *= 1.0 - dot(d, d) * 0.55;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

/**
 * Takes over rendering for the Canvas and repaints each frame as an oil-on-canvas
 * study. Html overlays stay crisp because they live in the DOM.
 */
export function PaintedLook({ spread = 2 }: { spread?: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const { composer, renderPass, kuwahara, finish } = useMemo(() => {
    const composer = new EffectComposer(gl)
    const renderPass = new RenderPass(scene, camera)
    const output = new OutputPass()
    const kuwahara = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          resolution: { value: new THREE.Vector2(1, 1) },
          spread: { value: spread },
        },
        vertexShader: VERT,
        fragmentShader: KUWAHARA_FRAG,
      }),
    )
    const finish = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          resolution: { value: new THREE.Vector2(1, 1) },
          pixelRatio: { value: 1 },
        },
        vertexShader: VERT,
        fragmentShader: FINISH_FRAG,
      }),
    )
    composer.addPass(renderPass)
    // Tone-map + sRGB first so the paint passes work on display colours
    composer.addPass(output)
    composer.addPass(kuwahara)
    composer.addPass(finish)
    return { composer, renderPass, kuwahara, finish }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene])

  useEffect(() => {
    composer.setPixelRatio(dpr)
    composer.setSize(size.width, size.height)
    const w = size.width * dpr
    const h = size.height * dpr
    kuwahara.uniforms.resolution.value.set(w, h)
    kuwahara.uniforms.spread.value = spread * dpr
    finish.uniforms.resolution.value.set(w, h)
    finish.uniforms.pixelRatio.value = dpr
  }, [composer, kuwahara, finish, size.width, size.height, dpr, spread])

  useEffect(() => () => composer.dispose(), [composer])

  useFrame((state, delta) => {
    renderPass.camera = state.camera
    composer.render(delta)
  }, 1)

  return null
}
