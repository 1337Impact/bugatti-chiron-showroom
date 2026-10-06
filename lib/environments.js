import * as THREE from 'three';

// Image-based lighting built from emissive "light formers" instead of an HDR
// photograph: each preset is a small scene of glowing panels that is baked
// into a prefiltered environment map.

// `flat` panels hang horizontally (size = [x, z]); the rest face `look`.
function former(scene, { size, pos, look = [0, 0, 0], color = 0xffffff, intensity = 1, round = false, flat = false }) {
  const geo = round ? new THREE.CircleGeometry(size[0] / 2, 48) : new THREE.PlaneGeometry(size[0], size[1]);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  if (flat) mesh.rotation.x = Math.PI / 2;
  else mesh.lookAt(...look);
  scene.add(mesh);
  return mesh;
}

function shell(scene, top, horizon, bottom, falloff = 3) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uBottom: { value: new THREE.Color(bottom) },
      uExp: { value: falloff },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uBottom;
      uniform float uExp;
      varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        vec3 c = h > 0.0 ? mix(uHorizon, uTop, 1.0 - exp(-h * uExp)) : mix(uHorizon, uBottom, pow(-h, 0.45));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), mat));
}

const PRESETS = {
  // Black room, long soft boxes: the classic car-studio look.
  dark(scene) {
    shell(scene, 0x050506, 0x0b0c0f, 0x020202);
    former(scene, { size: [3.2, 11], pos: [0, 7, 0], intensity: 3.4, flat: true });
    for (let i = -2; i <= 2; i++) {
      former(scene, { size: [9, 0.35], pos: [0, 6.4, i * 3.1], intensity: 5.5, flat: true });
    }
    former(scene, { size: [13, 1.6], pos: [9, 2.6, 0], intensity: 2.6 });
    former(scene, { size: [13, 1.6], pos: [-9, 2.6, 0], intensity: 2.6 });
    former(scene, { size: [13, 0.3], pos: [9, 0.9, 0], intensity: 3.6, color: 0xbfd4ff });
    former(scene, { size: [13, 0.3], pos: [-9, 0.9, 0], intensity: 3.6, color: 0xbfd4ff });
    former(scene, { size: [7, 1.4], pos: [0, 3.2, 11], intensity: 2.2 });
    former(scene, { size: [7, 1.4], pos: [0, 3.2, -11], intensity: 2.6, color: 0xffe9d6 });
    former(scene, { size: [2.4, 2.4], pos: [7, 6, 7], intensity: 5, round: true });
    former(scene, { size: [2.4, 2.4], pos: [-7, 6, -7], intensity: 5, round: true });
  },
  // White cyclorama with a few black flags so the paint still has contrast.
  light(scene) {
    shell(scene, 0xf4f5f7, 0xe9eaee, 0xbfc2c8);
    former(scene, { size: [8, 14], pos: [0, 8, 0], intensity: 2.6, flat: true });
    former(scene, { size: [14, 3], pos: [10, 3, 0], intensity: 1.7 });
    former(scene, { size: [14, 3], pos: [-10, 3, 0], intensity: 1.7 });
    former(scene, { size: [14, 0.9], pos: [9.5, 5.6, 0], intensity: 1, color: 0x08090b });
    former(scene, { size: [14, 0.9], pos: [-9.5, 5.6, 0], intensity: 1, color: 0x08090b });
    former(scene, { size: [8, 0.7], pos: [0, 5.4, 11], intensity: 1, color: 0x0c0d10 });
    former(scene, { size: [8, 0.7], pos: [0, 5.4, -11], intensity: 1, color: 0x0c0d10 });
  },
  // Open sky after sunset: cool zenith, warm band on the horizon, low sun.
  dusk(scene) {
    shell(scene, 0x0b1436, 0x9c4826, 0x0a0a0d, 16);
    former(scene, { size: [30, 1.6], pos: [-26, 0.9, -22], intensity: 1.1, color: 0xff7a3a });
    former(scene, { size: [1.8, 1.8], pos: [-24, 1.5, -20], intensity: 14, color: 0xffb070, round: true });
    former(scene, { size: [30, 8], pos: [24, 9, 20], intensity: 0.9, color: 0x5c7cff });
    former(scene, { size: [10, 10], pos: [0, 22, 0], intensity: 0.55, color: 0x8fa6ff, flat: true });
    former(scene, { size: [16, 0.5], pos: [10, 1.2, 4], intensity: 2.2, color: 0xffd2a8 });
  },
};

// What the floor and the page background should look like under each preset.
export const ENV_LOOK = {
  dark: { top: 0x020203, horizon: 0x0c0d10, floor: 0x060607, pool: 0x2b2d32, fog: 0x0c0d10, reflectivity: 0.5, shadow: 0.92, grid: 0xffffff, ui: 'dark', intensity: 1.0, showSky: false },
  light: { top: 0xc4c7cd, horizon: 0xe2e4e8, floor: 0xd4d6da, pool: 0xf2f3f5, fog: 0xe2e4e8, reflectivity: 0.34, shadow: 0.62, grid: 0x14161a, ui: 'light', intensity: 0.92, showSky: false },
  dusk: { top: 0x0a0a0d, horizon: 0x0a0a0d, floor: 0x0b0b0e, pool: 0x1d1b20, fog: 0x0a0a0d, reflectivity: 0.55, shadow: 0.9, grid: 0xffd2a8, ui: 'dark', intensity: 1.1, showSky: true },
};

export function buildEnvironments(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const out = {};
  for (const [id, build] of Object.entries(PRESETS)) {
    const scene = new THREE.Scene();
    build(scene);
    out[id] = pmrem.fromScene(scene, 0.012, 0.1, 100).texture;
    scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }
  pmrem.dispose();
  return out;
}

// Gradient backdrop for the studio presets: a touch of haze at the horizon so
// dark paint keeps a readable silhouette, and the floor has something to fade into.
export function createBackdrop() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon;
      varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        gl_FragColor = vec4(mix(uHorizon, uTop, smoothstep(0.0, 0.42, h)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = 'backdrop';
  return mesh;
}
