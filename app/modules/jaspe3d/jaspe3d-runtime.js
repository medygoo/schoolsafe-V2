import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function createJaspe3DController({ diagnostics, expectedActions, modelUrl }) {
  let host = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let model = null;
  let mixer = null;
  let activeAction = null;
  let resizeObserver = null;
  let animationFrame = 0;
  let loadPromise = null;
  let pendingAction = "Idle";
  let pendingOptions = {};
  let lastFrameAt = performance.now();
  let fpsWindowAt = lastFrameAt;
  let fpsFrames = 0;
  let destroyed = false;
  const actions = new Map();
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  diagnostics.threeVersion = THREE.REVISION;
  diagnostics.reducedMotion = reducedMotion;

  function recordError(error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    diagnostics.errors.push(message);
    diagnostics.loaded = false;
    if (host) {
      host.classList.remove("is-loading", "is-ready");
      host.classList.add("is-fallback");
    }
    throw error;
  }

  function createScene() {
    if (renderer) return;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    camera.position.set(0, 1.1, 3.6);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.tabIndex = -1;

    scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x18243d, 2.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(2.8, 4.2, 4.5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xaec9ff, 1.2);
    fillLight.position.set(-3, 2.2, 2.4);
    scene.add(fillLight);

    diagnostics.instanceCount = 1;
  }

  function fitModel() {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.y -= box.min.y;
    model.position.z -= center.z;
    camera.position.set(0, Math.max(size.y * 0.5, 0.9), Math.max(size.y * 1.42, 2.4));
    camera.lookAt(0, Math.max(size.y * 0.48, 0.85), 0);
    camera.near = 0.01;
    camera.far = Math.max(20, size.y * 8);
    camera.updateProjectionMatrix();
  }

  function validateClips(clips) {
    const names = clips.map((clip) => clip.name);
    if (names.length !== expectedActions.length || expectedActions.some((name) => !names.includes(name))) {
      throw new Error(`Clips JASPE inattendus : ${names.join(", ")}`);
    }
    diagnostics.clipNames = names.slice();
  }

  function loadModel() {
    if (loadPromise) return loadPromise;
    const startedAt = performance.now();
    loadPromise = new Promise((resolve, reject) => {
      new GLTFLoader().load(modelUrl, (gltf) => {
        try {
          validateClips(gltf.animations);
          model = gltf.scene;
          model.traverse((object) => {
            if (object.isMesh) {
              object.frustumCulled = false;
              object.castShadow = false;
              object.receiveShadow = false;
            }
          });
          scene.add(model);
          fitModel();
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => actions.set(clip.name, mixer.clipAction(clip)));
          mixer.addEventListener("finished", () => {
            if (diagnostics.currentAction !== "Idle") play("Idle", { once: false, fadeSeconds: 0.18 });
          });
          diagnostics.loaded = true;
          diagnostics.loadMs = Number((performance.now() - startedAt).toFixed(1));
          if (host) {
            host.classList.remove("is-loading", "is-fallback");
            host.classList.add("is-ready");
          }
          play(pendingAction, pendingOptions);
          resolve(true);
        } catch (error) {
          reject(error);
        }
      }, undefined, reject);
    }).catch(recordError);
    return loadPromise;
  }

  function resize() {
    if (!host || !renderer || !camera) return;
    const bounds = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function renderFrame(now) {
    if (destroyed || !renderer) return;
    const deltaSeconds = Math.min((now - lastFrameAt) / 1000, 0.05);
    lastFrameAt = now;
    if (mixer && !reducedMotion) mixer.update(deltaSeconds);
    renderer.render(scene, camera);
    fpsFrames += 1;
    if (now - fpsWindowAt >= 1000) {
      diagnostics.fps = Number(((fpsFrames * 1000) / (now - fpsWindowAt)).toFixed(1));
      diagnostics.rendererInfo = {
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        calls: renderer.info.render.calls,
      };
      fpsFrames = 0;
      fpsWindowAt = now;
    }
    animationFrame = globalThis.requestAnimationFrame(renderFrame);
  }

  async function mount(nextHost) {
    if (destroyed) return false;
    host = nextHost;
    try {
      createScene();
    } catch (error) {
      recordError(error);
    }
    if (renderer.domElement.parentElement !== host) host.prepend(renderer.domElement);
    if (!resizeObserver) resizeObserver = new ResizeObserver(resize);
    resizeObserver.disconnect();
    resizeObserver.observe(host);
    resize();
    if (!animationFrame) animationFrame = globalThis.requestAnimationFrame(renderFrame);
    if (diagnostics.loaded) {
      host.classList.remove("is-loading", "is-fallback");
      host.classList.add("is-ready");
    }
    await loadModel();
    return true;
  }

  function play(actionName, options = {}) {
    if (!expectedActions.includes(actionName)) actionName = "Idle";
    pendingAction = actionName;
    pendingOptions = options;
    if (!mixer || !actions.has(actionName)) return false;

    const nextAction = actions.get(actionName);
    const once = options.once ?? actionName !== "Idle";
    const fadeSeconds = options.fadeSeconds ?? 0.2;
    if (activeAction && activeAction !== nextAction) activeAction.fadeOut(fadeSeconds);
    nextAction.reset();
    nextAction.enabled = true;
    nextAction.clampWhenFinished = once;
    nextAction.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    if (reducedMotion) nextAction.paused = true;
    else nextAction.paused = false;
    nextAction.fadeIn(fadeSeconds).play();
    activeAction = nextAction;
    diagnostics.currentAction = actionName;
    if (reducedMotion) renderer.render(scene, camera);
    return true;
  }

  function disposeMaterial(material) {
    for (const value of Object.values(material)) {
      if (value && value.isTexture) value.dispose();
    }
    material.dispose();
  }

  function destroy() {
    destroyed = true;
    if (animationFrame) globalThis.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    resizeObserver?.disconnect();
    resizeObserver = null;
    mixer?.stopAllAction();
    model?.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach(disposeMaterial);
    });
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer?.domElement.remove();
    actions.clear();
    diagnostics.loaded = false;
    diagnostics.instanceCount = 0;
  }

  return { mount, play, destroy };
}
