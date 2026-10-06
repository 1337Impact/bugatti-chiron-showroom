import * as THREE from 'three';

// The GLB carries material *names* (set in tools/build_model.py); the looks are
// defined here so paint, finish and lights can be driven live.

const P = (o) => new THREE.MeshPhysicalMaterial(o);
const S = (o) => new THREE.MeshStandardMaterial(o);
const D = THREE.DoubleSide; // the body is a single-surface shell

export function createMaterials() {
  return {
    paint_primary: P({ color: '#0b44c9', metalness: 0.7, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.035, side: D }),
    paint_secondary: P({ color: '#07122e', metalness: 0.7, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.035, side: D }),
    chrome_trim: S({ color: '#d8dade', metalness: 1, roughness: 0.14, side: D }),
    glass_window: P({ color: '#020304', metalness: 0, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.1, side: D }),
    trim_black: S({ color: '#070708', metalness: 0.1, roughness: 0.38, side: D }),
    arch_black: S({ color: '#040404', metalness: 0, roughness: 0.92, side: D }),
    vent_black: S({ color: '#020202', metalness: 0, roughness: 0.8, side: D }),
    diffuser: S({ color: '#0a0a0b', metalness: 0.3, roughness: 0.42, side: D }),
    mirror_glass: S({ color: '#e6e8ea', metalness: 1, roughness: 0.03 }),
    exhaust: S({ color: '#8d9299', metalness: 1, roughness: 0.26, side: D }),
    grill: S({ color: '#26272a', metalness: 0.9, roughness: 0.34, side: D }),
    tyre: S({ color: '#0b0b0b', metalness: 0, roughness: 0.86 }),
    rim: S({ color: '#c9cbcf', metalness: 1, roughness: 0.2, side: D }),
    rim_accent: P({ color: '#0b44c9', metalness: 0.7, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.05, side: D }),
    rim_cap: S({ color: '#17181a', metalness: 0.9, roughness: 0.42, side: D }), // inner barrel
    wheel_nut: S({ color: '#1d1e20', metalness: 1, roughness: 0.3 }),
    brake_disc: S({ color: '#3a3b3e', metalness: 0.8, roughness: 0.46, side: D }),
    hub: S({ color: '#0c0c0d', metalness: 0.5, roughness: 0.6, side: D }),
    caliper: P({ color: '#0b44c9', metalness: 0.3, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08, side: D }),
    engine: S({ color: '#8b8e93', metalness: 1, roughness: 0.34, side: D }),
    engine_text: S({ color: '#101113', metalness: 0.6, roughness: 0.4, side: D }),
    headlight_lens: P({ color: '#cfe6ff', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.3, depthWrite: false, side: D }),
    headlight_emit: S({ color: '#d7dbe0', metalness: 0.2, roughness: 0.25, emissive: '#e8f1ff', emissiveIntensity: 5 }),
    headlight_housing: S({ color: '#0d0d0f', metalness: 1, roughness: 0.22, side: D }),
    headlight_cover: P({ color: '#ffffff', metalness: 0, roughness: 0, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 2.5 }),
    headlight_trim: S({ color: '#9a9da1', metalness: 1, roughness: 0.2, side: D }),
    // Lit parts are single-sided so their glow is never seen from inside the
    // shell (it leaked into the floor reflection). The lens faces inwards in the source mesh.
    taillight_glass: P({ color: '#3d0003', metalness: 0, roughness: 0.1, clearcoat: 1, emissive: '#ff0a08', emissiveIntensity: 0.4, side: THREE.BackSide }),
    taillight_trim: S({ color: '#0a0a0b', metalness: 0.8, roughness: 0.3, side: D }),
    taillight_emit: S({ color: '#4a0003', metalness: 0, roughness: 0.3, emissive: '#ff1408', emissiveIntensity: 5 }),
    badge_red: P({ color: '#8d0408', metalness: 0.2, roughness: 0.25, clearcoat: 1, side: D }),
    badge_chrome: S({ color: '#e4e5e8', metalness: 1, roughness: 0.1, side: D }),
    strut_metal: S({ color: '#8e9197', metalness: 1, roughness: 0.25, side: D }),
    strut_chrome: S({ color: '#e4e5e8', metalness: 1, roughness: 0.06, side: D }),
    strut_dark: S({ color: '#0d0d0f', metalness: 0.8, roughness: 0.35, side: D }),
    cable: S({ color: '#050505', metalness: 0, roughness: 0.5 }),
    underbody: S({ color: '#020202', metalness: 0, roughness: 1, side: D }),
  };
}

// `metal` maps the paint's own base-coat metalness to the finished surface.
export const FINISH = {
  gloss: { metal: (m) => m, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.035, iridescence: 0 },
  satin: { metal: (m) => m, roughness: 0.52, clearcoat: 0.35, clearcoatRoughness: 0.45, iridescence: 0 },
  matte: { metal: (m) => Math.min(m, 0.3), roughness: 0.78, clearcoat: 0, clearcoatRoughness: 0.6, iridescence: 0 },
  pearl: { metal: () => 0.85, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 1 },
  chrome: { metal: () => 1, roughness: 0.06, clearcoat: 0, clearcoatRoughness: 0, iridescence: 0 },
};

export const WHEEL_LOOK = {
  // accent: null means "follow the front paint colour"
  duo: { rim: '#c9cbcf', rimRough: 0.2, accent: null, accentMetal: 0.7, accentRough: 0.34 },
  silver: { rim: '#c9cbcf', rimRough: 0.2, accent: '#c9cbcf', accentMetal: 1, accentRough: 0.24 },
  black: { rim: '#0a0a0b', rimRough: 0.28, accent: '#070708', accentMetal: 0.6, accentRough: 0.3 },
  gunmetal: { rim: '#4a4d52', rimRough: 0.24, accent: '#1c1d20', accentMetal: 0.9, accentRough: 0.32 },
};

// Racing stripes are drawn in the paint shader from the car-space X coordinate,
// so the model needs no UVs. `uniforms` is shared by every paint material.
export function addLivery(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLivery = uniforms.uLivery;
    shader.uniforms.uStripe = uniforms.uStripe;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCarX;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCarX = position.x;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCarX;\nuniform int uLivery;\nuniform vec3 uStripe;\nfloat liveryMask = 0.0;')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        if (uLivery > 0) {
          float x = vCarX;
          float aa = fwidth(x) * 1.2 + 1e-4;
          float m = 0.0;
          if (uLivery == 1) {
            m = 1.0 - smoothstep(0.062 - aa, 0.062 + aa, abs(abs(x) - 0.15));
          } else if (uLivery == 2) {
            m = 1.0 - smoothstep(0.17 - aa, 0.17 + aa, abs(x));
          } else {
            m = max(1.0 - smoothstep(0.085 - aa, 0.085 + aa, abs(x - 0.40)),
                    1.0 - smoothstep(0.018 - aa, 0.018 + aa, abs(x - 0.545)));
          }
          liveryMask = m;
          diffuseColor.rgb = mix(diffuseColor.rgb, uStripe, m);
        }`
      )
      // stripes are solid paint: drop the metallic flake under them
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - 0.85 * liveryMask;');
  };
  material.customProgramCacheKey = () => 'livery';
}
