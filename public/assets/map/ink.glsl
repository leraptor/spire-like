// ABOUTME: Fragment shader that renders an ink splat using Matt DesLauriers' ink() function.
// ABOUTME: Source: github.com/mattdesl/material/lib/shader/ink.glsl, with simplex-noise + aastep inlined for WebGL.

#pragma phaserTemplate(shaderName)

#extension GL_OES_standard_derivatives : enable

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 outTexCoord;

uniform float uTime;
uniform float uSeed;
uniform float uAlpha;
uniform float uGrowth;
uniform vec3  uInkColor;

// --- Ashima 2D simplex noise (MIT) -----------------------------------------
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float noise2(vec2 v) {
  const vec4 C = vec4(0.211324865405187,
                      0.366025403784439,
                     -0.577350269189626,
                      0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                 + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// --- glsl-aastep (MIT) -----------------------------------------------------
float aastep(float threshold, float value) {
#ifdef GL_OES_standard_derivatives
  float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
#else
  float afwidth = 0.005;
#endif
  return smoothstep(threshold - afwidth, threshold + afwidth, value);
}

// --- ink.glsl (Matt DesLauriers, mattdesl/material) -------------------------
float absorb(float sdf, vec2 uv, float scale, float falloff) {
  vec2 seedOffset = vec2(uSeed, uSeed * 1.61803398875);
  float distort = sdf + noise2(uv * scale + seedOffset) * falloff;
  return aastep(0.5, distort);
}

// Graffiti-spray variant ported from the upstream shader.
float ink(float sdf, vec2 uv, float time) {
  float alpha = 0.0;
  vec2 tex = uv;
  alpha += absorb(sdf, tex, 600.0, 0.1) * 0.2;
  alpha += absorb(sdf, tex, 300.0, 0.1) * 0.2;
  alpha += absorb(sdf, tex, 20.0, 0.05) * 0.2;
  alpha += absorb(sdf, tex, 400.0, 0.05) * 0.2;
  alpha += absorb(sdf, tex, 100.0, 0.2) * 0.2;
  return alpha;
}

void main() {
  vec2 uv = outTexCoord;

  vec2 p = uv - vec2(0.5);
  float d = length(p);

  // Wobble the disk outline with large-scale noise so the drop isn't a perfect circle.
  float angle = atan(p.y, p.x);
  float wobble = noise2(vec2(cos(angle), sin(angle)) * 3.0 + uSeed) * 0.06;

  // Proper SDF-style field: linearly falls off around the drop radius so the
  // 0.5 iso-contour lives in a band wide enough for the multi-scale noise layers
  // to actually break it up into a spray pattern.
  float r = (0.24 + wobble) * uGrowth;
  float k = 2.0; // lower = wider spray band; the upstream layers need a generous
                 // edge range so high-frequency absorption reads as ink bloom.
  float sdf = 0.5 + (r - d) * k;
  sdf = clamp(sdf, 0.0, 1.0);

  float a = ink(sdf, uv, uTime) * uAlpha;

  // MULTIPLY blend on the GameObject side; mix toward white where there's no ink
  // so the parchment stays untouched outside the splat.
  vec3 col = mix(vec3(1.0), uInkColor, a);
  gl_FragColor = vec4(col, 1.0);
}
