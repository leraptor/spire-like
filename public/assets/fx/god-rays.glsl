// ABOUTME: Phaser 4 fragment shader adapting the CC0 Godot Shaders god-rays effect.
// ABOUTME: Source inspiration: https://godotshaders.com/shader/god-rays/

#pragma phaserTemplate(shaderName)

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 outTexCoord;

uniform float uTime;
uniform float uAngle;
uniform float uPosition;
uniform float uSpread;
uniform float uCutoff;
uniform float uFalloff;
uniform float uEdgeFade;
uniform float uSpeed;
uniform float uRay1Density;
uniform float uRay2Density;
uniform float uRay2Intensity;
uniform float uSeed;
uniform vec3 uColor;
uniform float uAlpha;

float random2(vec2 uv) {
  return fract(sin(dot(uv.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float valueNoise(vec2 uv) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);

  float a = random2(i);
  float b = random2(i + vec2(1.0, 0.0));
  float c = random2(i + vec2(0.0, 1.0));
  float d = random2(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(a, b, u.x)
    + (c - a) * u.y * (1.0 - u.x)
    + (d - b) * u.x * u.y;
}

mat2 rotate2(float angle) {
  return mat2(
    vec2(cos(angle), -sin(angle)),
    vec2(sin(angle), cos(angle))
  );
}

void main() {
  vec2 uv = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
  vec2 transformedUv = (rotate2(uAngle) * (uv - uPosition)) / ((uv.y + uSpread) - (uv.y * uSpread));

  vec2 ray1 = vec2(
    transformedUv.x * uRay1Density + sin(uTime * 0.1 * uSpeed) * (uRay1Density * 0.2) + uSeed,
    1.0
  );
  vec2 ray2 = vec2(
    transformedUv.x * uRay2Density + sin(uTime * 0.2 * uSpeed) * (uRay1Density * 0.2) + uSeed,
    1.0
  );

  float cut = step(uCutoff, transformedUv.x) * step(uCutoff, 1.0 - transformedUv.x);
  ray1 *= cut;
  ray2 *= cut;

  float rays = clamp(valueNoise(ray1) + (valueNoise(ray2) * uRay2Intensity), 0.0, 1.0);
  rays *= smoothstep(0.0, uFalloff, 1.0 - uv.y);
  rays *= smoothstep(uCutoff, uEdgeFade + uCutoff, transformedUv.x);
  rays *= smoothstep(uCutoff, uEdgeFade + uCutoff, 1.0 - transformedUv.x);

  vec3 color = uColor * rays;
  gl_FragColor = vec4(color, rays * uAlpha);
}
