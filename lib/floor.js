import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// Showroom floor: a planar reflection that is blurred and Fresnel-weighted,
// with the Blender-baked contact shadow, an optional metre grid, and a radial
// fade into the backdrop so there is no visible horizon edge.

const FloorShader = {
  name: 'ShowroomFloor',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    tShadow: { value: null },
    uFloor: { value: new THREE.Color(0x050506) },
    uPool: { value: new THREE.Color(0x17181b) },
    uPoolRadius: { value: 6.5 },
    uFog: { value: new THREE.Color(0x040405) },
    uGridColor: { value: new THREE.Color(0xffffff) },
    uReflectivity: { value: 0.6 },
    uBlur: { value: 0.0042 },
    uShadow: { value: 0.9 },
    uShadowSize: { value: 7 },
    uCar: { value: new THREE.Vector2() },
    uGrid: { value: 0 },
    uFade: { value: new THREE.Vector2(7, 26) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tShadow;
    uniform vec3 uFloor, uFog, uGridColor, uPool;
    uniform float uReflectivity, uBlur, uShadow, uShadowSize, uGrid, uPoolRadius;
    uniform vec2 uCar, uFade;
    varying vec4 vUv;
    varying vec3 vWorld;

    float ign(vec2 p) {            // interleaved gradient noise, rotates the blur kernel per pixel
      return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
    }

    void main() {
      vec2 uv = vUv.xy / vUv.w;
      vec3 view = normalize(cameraPosition - vWorld);
      float dist = length(cameraPosition - vWorld);

      // blurred mirror: 16 taps on a per-pixel rotated spiral (constant size on
      // the floor, so it shrinks on screen with distance)
      float a = ign(gl_FragCoord.xy) * 6.2831853;
      float radius = uBlur * (0.35 + 3.0 / max(dist, 1.5));
      vec3 refl = vec3(0.0);
      for (int i = 0; i < 16; i++) {
        float fi = float(i);
        float r = sqrt((fi + 0.5) / 16.0);
        float t = a + fi * 2.3999632;
        refl += texture2D(tDiffuse, uv + vec2(cos(t), sin(t)) * r * radius).rgb;
      }
      refl /= 16.0;

      float fresnel = mix(0.28, 1.0, pow(1.0 - clamp(view.y, 0.0, 1.0), 2.4));

      // contact shadow baked in Blender (alpha = occlusion), follows the car
      vec2 sp = (vWorld.xz - uCar) / uShadowSize;
      vec2 suv = vec2(sp.x + 0.5, 0.5 - sp.y);
      float sh = 0.0;
      if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) {
        vec2 e = smoothstep(0.0, 0.08, suv) * smoothstep(0.0, 0.08, 1.0 - suv);
        sh = texture2D(tShadow, suv).a * e.x * e.y;
      }

      // pool of light under the car so the floor (and the shadow on it) reads
      float pool = exp(-dot(vWorld.xz - uCar, vWorld.xz - uCar) / (uPoolRadius * uPoolRadius));
      vec3 col = mix(uFloor, uPool, pool) * (1.0 - uShadow * sh);
      col = mix(col, refl, uReflectivity * fresnel * (1.0 - 0.35 * sh));

      if (uGrid > 0.001) {
        vec2 g = vWorld.xz;
        vec2 w = fwidth(g);
        vec2 l = abs(fract(g - 0.5) - 0.5) / max(w, vec2(1e-5));
        float line = 1.0 - min(min(l.x, l.y), 1.0);
        vec2 l5 = abs(fract(g / 5.0 - 0.5) - 0.5) / max(w / 5.0, vec2(1e-5));
        float major = 1.0 - min(min(l5.x, l5.y), 1.0);
        float gridFade = 1.0 - smoothstep(4.0, 22.0, length(g));
        col = mix(col, uGridColor, clamp(line * 0.16 + major * 0.3, 0.0, 1.0) * gridFade * uGrid);
      }

      float fade = smoothstep(uFade.x, uFade.y, length(vWorld.xz));
      col = mix(col, uFog, fade);

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export function createFloor(shadowTexture, resolution = 1024) {
  const floor = new Reflector(new THREE.CircleGeometry(60, 64), {
    textureWidth: resolution,
    textureHeight: resolution,
    clipBias: 0.003,
    shader: FloorShader,
    multisample: 0,
  });
  floor.rotation.x = -Math.PI / 2;
  floor.material.uniforms.tShadow.value = shadowTexture;
  floor.name = 'floor';
  return floor;
}
