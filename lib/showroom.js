import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { N8AOPass } from 'n8ao';

import { buildEnvironments, createBackdrop, ENV_LOOK } from './environments.js';
import { createFloor } from './floor.js';
import { createMaterials, addLivery, FINISH, WHEEL_LOOK } from './materials.js';
import { PAINTS, CALIPERS, LIGHT_HUES, STRIPE_COLOURS, LIVERIES, VIEWS, DEFAULTS, byId } from './config.js';

const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

const WING_RETRACT = 0.112; // metres the blade drops to sit on the tail
const WING_TILT = 0.66; // radians of airbrake pitch
const ROLL_IN = 9; // metres the car drives during the intro
const QUALITY = {
  low: { ratio: 1, reflection: 512, post: false },
  medium: { ratio: 1.5, reflection: 1024, post: true, ao: false },
  high: { ratio: 2, reflection: 1536, post: true, ao: true },
};

export class Showroom {
  constructor(container) {
    this.container = container;
    this.state = { ...DEFAULTS };
    this.tweens = new Set();
    this.clock = new THREE.Clock();
    this.entered = false;
    this.wing = { lift: 1, tilt: 0 };
    this.lightLevel = 0;

    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x040405, 1);
    container.appendChild(renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 900);
    this.camera.position.set(-2.4, 0.5, 8.4);

    const controls = (this.controls = new OrbitControls(this.camera, renderer.domElement));
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.492;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.7;
    controls.autoRotateSpeed = 0.55;
    controls.target.set(0, 0.55, 0);
    controls.enabled = false;
    controls.addEventListener('start', () => {
      this.cancelFlight();
      this.onInteract?.();
    });

    this.livery = { uLivery: { value: 0 }, uStripe: { value: new THREE.Color('#f1f1f1') } };
    this.mats = createMaterials();
    addLivery(this.mats.paint_primary, this.livery);
    addLivery(this.mats.paint_secondary, this.livery);

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    window.addEventListener('resize', this.resize);
  }

  // ------------------------------------------------------------------ loading
  /** Resolves to false if the showroom was disposed while loading. */
  async load(onProgress = () => {}) {
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const gltfLoader = new GLTFLoader().setDRACOLoader(draco);
    const [gltf, shadow] = await Promise.all([
      new Promise((res, rej) =>
        gltfLoader.load(
          '/models/chiron.glb',
          res,
          (e) => onProgress(e.total ? (e.loaded / e.total) * 0.8 : 0.4),
          rej
        )
      ),
      new THREE.TextureLoader().loadAsync('/textures/ground_shadow.png'),
    ]);
    draco.dispose();
    if (this.disposed) return false;
    onProgress(0.85);

    // car
    const car = (this.car = gltf.scene);
    this.wheels = [];
    car.traverse((o) => {
      if (o.isMesh) {
        const m = this.mats[o.material.name];
        if (m) o.material = m;
        else console.warn('unmapped material', o.material.name);
        if (o.material.transparent) o.renderOrder = 2;
      }
      if (o.name.startsWith('wheel_')) this.wheels.push({ node: o, radius: 0.35 });
      if (o.name === 'wing') this.wingNode = o;
      if (o.name === 'wing_struts') this.strutNode = o;
    });
    for (const w of this.wheels) {
      const box = new THREE.Box3().setFromObject(w.node);
      w.radius = (box.max.y - box.min.y) / 2;
    }
    this.wingBase = this.wingNode.position.clone();
    this.strutBase = this.strutNode.position.clone();
    car.position.z = -ROLL_IN;
    this.scene.add(car);

    // environment + floor
    this.envs = buildEnvironments(this.renderer);
    onProgress(0.92);
    shadow.colorSpace = THREE.NoColorSpace;
    shadow.anisotropy = 4;
    this.floor = createFloor(shadow, QUALITY[this.state.quality].reflection);
    this.scene.add(this.floor);
    this.backdrop = createBackdrop();
    this.scene.add(this.backdrop);

    this.applyAll();
    this.setLights(false, true);
    this.resize();
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* compile on first frame instead */
    }
    if (this.disposed) return false;
    onProgress(1);
    this.renderer.setAnimationLoop(this.frame);
    return true;
  }

  // ------------------------------------------------------------- configuration
  applyAll() {
    const s = this.state;
    this.setEnvironment(s.environment);
    this.setPaint('front', s.front);
    this.setPaint('rear', s.rear);
    this.setFinish(s.finish);
    this.setCaliper(s.caliper);
    this.setWheels(s.wheels);
    this.setLightHue(s.lightHue);
    this.setLivery(s.livery);
    this.setStripe(s.stripe);
    this.setGrid(s.grid, true);
    this.setExposure(s.exposure);
    this.setQuality(s.quality);
    this.setBloom(s.bloom);
  }

  setPaint(zone, idOrHex) {
    const hex = byId(PAINTS, idOrHex)?.hex ?? idOrHex;
    this.state[zone] = idOrHex;
    const mat = zone === 'front' ? this.mats.paint_primary : this.mats.paint_secondary;
    this.tweenColor(mat.color, hex);
    this.setFinish(this.state.finish);
    if (zone === 'front') this.setWheels(this.state.wheels);
  }

  setFinish(id) {
    this.state.finish = id;
    const f = FINISH[id];
    for (const [zone, m] of [['front', this.mats.paint_primary], ['rear', this.mats.paint_secondary]]) {
      m.metalness = f.metal(byId(PAINTS, this.state[zone])?.metal ?? 0.6);
      m.roughness = f.roughness;
      m.clearcoat = f.clearcoat;
      m.clearcoatRoughness = f.clearcoatRoughness;
      m.iridescence = f.iridescence;
      m.iridescenceIOR = 1.8;
      m.iridescenceThicknessRange = [180, 620];
      m.needsUpdate = true;
    }
  }

  setCaliper(idOrHex) {
    this.state.caliper = idOrHex;
    this.tweenColor(this.mats.caliper.color, byId(CALIPERS, idOrHex)?.hex ?? idOrHex);
  }

  setWheels(id) {
    this.state.wheels = id;
    const look = WHEEL_LOOK[id];
    const { rim, rim_accent } = this.mats;
    this.tweenColor(rim.color, look.rim);
    rim.roughness = look.rimRough;
    const front = byId(PAINTS, this.state.front)?.hex ?? this.state.front;
    this.tweenColor(rim_accent.color, look.accent ?? front);
    rim_accent.metalness = look.accentMetal;
    rim_accent.roughness = look.accentRough;
    rim_accent.clearcoat = id === 'silver' || id === 'gunmetal' ? 0 : 1;
  }

  setLights(on, instant = false) {
    this.state.lights = on;
    const apply = (v) => {
      this.lightLevel = v;
      this.mats.headlight_emit.emissiveIntensity = 6.5 * v;
      this.mats.taillight_emit.emissiveIntensity = 0.25 + 5.5 * v;
      this.mats.taillight_glass.emissiveIntensity = 0.05 + 0.5 * v;
    };
    if (instant) return apply(on ? 1 : 0);
    // xenon-style strike: a short flicker, then a ramp
    const from = this.lightLevel;
    const to = on ? 1 : 0;
    this.tween({
      duration: on ? 0.7 : 0.35,
      onUpdate: (t) => {
        const flicker = on && t < 0.35 ? (Math.sin(t * 90) > 0.2 ? 0.75 : 0.1) : 1;
        apply(THREE.MathUtils.lerp(from, to, ease.outCubic(t)) * flicker);
      },
      key: 'lights',
    });
  }

  setLightHue(idOrHex) {
    this.state.lightHue = idOrHex;
    this.tweenColor(this.mats.headlight_emit.emissive, byId(LIGHT_HUES, idOrHex)?.hex ?? idOrHex);
  }

  setLivery(id) {
    this.state.livery = id;
    this.livery.uLivery.value = Math.max(0, LIVERIES.findIndex((l) => l.id === id));
  }

  setStripe(idOrHex) {
    this.state.stripe = idOrHex;
    this.livery.uStripe.value.set(byId(STRIPE_COLOURS, idOrHex)?.hex ?? idOrHex);
  }

  setWing(mode) {
    this.state.wing = mode;
    const target = { retracted: [0, 0], deployed: [1, 0], airbrake: [1, 1] }[mode];
    const from = [this.wing.lift, this.wing.tilt];
    this.tween({
      duration: 1.1,
      key: 'wing',
      onUpdate: (t) => {
        const k = ease.inOutCubic(t);
        this.wing.lift = THREE.MathUtils.lerp(from[0], target[0], k);
        this.wing.tilt = THREE.MathUtils.lerp(from[1], target[1], k);
        this.applyWing();
      },
    });
  }

  applyWing() {
    const { lift, tilt } = this.wing;
    const drop = (1 - lift) * WING_RETRACT;
    this.wingNode.position.set(this.wingBase.x, this.wingBase.y - drop + tilt * 0.035, this.wingBase.z + drop * 0.18);
    this.wingNode.rotation.x = tilt * WING_TILT - (1 - lift) * 0.045;
    this.strutNode.position.set(this.strutBase.x, this.strutBase.y - drop * 1.9, this.strutBase.z);
  }

  setGrid(on, instant = false) {
    this.state.grid = on;
    const u = this.floor.material.uniforms.uGrid;
    if (instant) return void (u.value = on ? 1 : 0);
    const from = u.value;
    this.tween({ duration: 0.5, key: 'grid', onUpdate: (t) => (u.value = THREE.MathUtils.lerp(from, on ? 1 : 0, ease.outCubic(t))) });
  }

  setEnvironment(id) {
    this.state.environment = id;
    const look = ENV_LOOK[id];
    const env = this.envs[id];
    this.scene.environment = env;
    this.scene.environmentIntensity = look.intensity;
    if (look.showSky) {
      this.scene.background = env;
      this.scene.backgroundBlurriness = 0.12;
      this.scene.backgroundIntensity = 0.8;
    } else {
      this.scene.background = null;
      this.backdrop.material.uniforms.uTop.value.set(look.top);
      this.backdrop.material.uniforms.uHorizon.value.set(look.horizon);
    }
    this.backdrop.visible = !look.showSky;
    const u = this.floor.material.uniforms;
    u.uFloor.value.set(look.floor);
    u.uFog.value.set(look.fog);
    u.uPool.value.set(look.pool);
    u.uGridColor.value.set(look.grid);
    u.uReflectivity.value = look.reflectivity;
    u.uShadow.value = look.shadow;
    u.uFade.value.set(look.showSky ? 30 : 7, look.showSky ? 180 : 26);
    this.onEnvironment?.(look.ui);
  }

  setEnvironmentRotation(rad) {
    this.state.envRotation = rad;
    this.scene.environmentRotation.y = rad;
    this.scene.backgroundRotation.y = rad;
  }

  setExposure(v) {
    this.state.exposure = v;
    this.renderer.toneMappingExposure = v;
  }

  setBloom(v) {
    this.state.bloom = v;
    if (this.bloomPass) this.bloomPass.strength = v;
  }

  setAutoRotate(on) {
    this.state.autoRotate = on;
    this.controls.autoRotate = on && this.entered;
  }

  setQuality(id) {
    this.state.quality = id;
    const q = QUALITY[id];
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, q.ratio);
    this.floor.getRenderTarget().setSize(q.reflection, q.reflection);
    this.floor.material.uniforms.uBlur.value = id === 'low' ? 0.006 : 0.0042;

    this.composer?.dispose();
    this.composer = null;
    this.bloomPass = null;
    if (q.post) {
      const size = new THREE.Vector2(this.container.clientWidth || 1, this.container.clientHeight || 1);
      const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.ao ? 0 : 4 });
      const composer = new EffectComposer(this.renderer, target);
      if (q.ao) {
        const ao = new N8AOPass(this.scene, this.camera, size.x, size.y);
        Object.assign(ao.configuration, { aoRadius: 0.45, distanceFalloff: 1, intensity: 2.2, halfRes: true, gammaCorrection: false });
        ao.setQualityMode('Medium');
        composer.addPass(ao);
      } else {
        composer.addPass(new RenderPass(this.scene, this.camera));
      }
      this.bloomPass = new UnrealBloomPass(size.clone(), this.state.bloom, 0.5, 2.2);
      composer.addPass(this.bloomPass);
      composer.addPass(new OutputPass());
      if (q.ao) composer.addPass(new SMAAPass(size.x, size.y));
      this.composer = composer;
    }
    this.resize();
  }

  // ------------------------------------------------------------------- camera
  /** Distance multiplier so the whole car stays in frame on narrow screens. */
  fit(close = false) {
    const aspect = this.camera.aspect;
    const f = Math.max(1, 1.62 / aspect);
    return close ? 1 + (f - 1) * 0.45 : f;
  }

  viewPose(id) {
    const v = byId(VIEWS, id) ?? VIEWS[0];
    const target = new THREE.Vector3(...v.target);
    const offset = new THREE.Vector3(...v.pos).sub(target).multiplyScalar(this.fit(v.close));
    return { target, offset };
  }

  flyTo(id, duration = 1.6) {
    this.state.view = id;
    const { target, offset } = this.viewPose(id);
    const fromTarget = this.controls.target.clone();
    const a = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(fromTarget));
    const b = new THREE.Spherical().setFromVector3(offset);
    let dTheta = b.theta - a.theta;
    dTheta = ((dTheta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; // shortest way round
    const s = new THREE.Spherical();
    const wasRotating = this.controls.autoRotate;
    this.controls.autoRotate = false;
    this.flight = this.tween({
      duration,
      key: 'camera',
      onUpdate: (t) => {
        const k = ease.inOutCubic(t);
        s.set(THREE.MathUtils.lerp(a.radius, b.radius, k), THREE.MathUtils.lerp(a.phi, b.phi, k), a.theta + dTheta * k);
        s.makeSafe();
        this.controls.target.lerpVectors(fromTarget, target, k);
        this.camera.position.setFromSpherical(s).add(this.controls.target);
      },
      onDone: () => {
        this.flight = null;
        this.controls.autoRotate = wasRotating && this.state.autoRotate;
      },
    });
  }

  cancelFlight() {
    if (this.flight) {
      this.flight.stop();
      this.flight = null;
      this.controls.autoRotate = this.state.autoRotate && this.entered;
    }
  }

  // -------------------------------------------------------------------- intro
  /** The car rolls out of the dark with its lights on while the camera drifts. */
  playIntro() {
    this.introStart = this.clock.elapsedTime;
    this.setLights(true);
    const from = this.car.position.z;
    this.tween({
      duration: 3.4,
      key: 'roll',
      onUpdate: (t) => this.moveCar(THREE.MathUtils.lerp(from, 0, ease.outQuart(t))),
    });
  }

  moveCar(z) {
    const dz = z - this.car.position.z;
    this.car.position.z = z;
    for (const w of this.wheels) w.node.rotation.x += dz / w.radius;
    this.floor.material.uniforms.uCar.value.set(this.car.position.x, z);
  }

  /** Leave the intro: finish the roll-in and hand the camera to the visitor. */
  enter() {
    if (this.entered) return;
    this.entered = true;
    this.introStart = null;
    if (Math.abs(this.car.position.z) > 0.01) {
      const from = this.car.position.z;
      this.tween({ duration: 0.9, key: 'roll', onUpdate: (t) => this.moveCar(THREE.MathUtils.lerp(from, 0, ease.outCubic(t))) });
    }
    if (!this.state.lights) this.setLights(true);
    this.controls.enabled = true;
    this.flyTo(this.state.view, 2.2);
    this.controls.autoRotate = false;
  }

  // ---------------------------------------------------------------- utilities
  tween({ duration, onUpdate, onDone, key }) {
    if (key) for (const t of this.tweens) if (t.key === key) this.tweens.delete(t);
    const t = { duration, onUpdate, onDone, key, time: 0, stop: () => this.tweens.delete(t) };
    this.tweens.add(t);
    return t;
  }

  tweenColor(color, hex, duration = 0.5) {
    const from = color.clone();
    const to = new THREE.Color(hex);
    if (!this.car || !this.entered) return void color.copy(to);
    this.tween({ duration, onUpdate: (t) => color.lerpColors(from, to, ease.outCubic(t)) });
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio ?? 1);
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio ?? 1);
      this.composer.setSize(w, h);
    }
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    for (const t of [...this.tweens]) {
      t.time += dt;
      const k = Math.min(t.time / t.duration, 1);
      t.onUpdate(k);
      if (k >= 1) {
        this.tweens.delete(t);
        t.onDone?.();
      }
    }
    if (this.introStart != null) {
      // slow cinematic drift across the nose until the visitor enters
      const t = this.clock.elapsedTime - this.introStart;
      const f = this.fit();
      const a = -0.32 + t * 0.045;
      const r = (8.6 - Math.min(t, 6) * 0.22) * f;
      this.camera.position.set(Math.sin(a) * r, 0.48 + Math.min(t, 8) * 0.05, Math.cos(a) * r);
      this.controls.target.set(0, 0.56, 0);
      this.camera.lookAt(this.controls.target);
    } else {
      this.controls.update(dt);
    }
    this.render();
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Stops rendering and releases the WebGL context (React unmount, hot reload). */
  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this.resize);
    this.renderer.setAnimationLoop(null);
    this.tweens.clear();
    this.controls.dispose();
    this.composer?.dispose();
    this.floor?.dispose();
    for (const env of Object.values(this.envs ?? {})) env.dispose();
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  /** Renders one frame at 2× the on-screen resolution and returns it as a PNG data URL. */
  capture() {
    const prev = this.pixelRatio ?? 1;
    const w = this.container.clientWidth;
    const scale = Math.min(Math.max(2, prev * 2), 3840 / w, 4);
    this.pixelRatio = scale;
    this.resize();
    this.render();
    const url = this.renderer.domElement.toDataURL('image/png');
    this.pixelRatio = prev;
    this.resize();
    this.render();
    return url;
  }
}
