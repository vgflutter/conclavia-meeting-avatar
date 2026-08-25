import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loopingGestures = new Set(["applause"]);

function normalizedName(value) {
  return String(value || "").trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

function boundedWeight(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function addMorphWeights(target, weights, scale = 1) {
  if (!weights) return;
  for (const [name, weight] of Object.entries(weights)) {
    const normalized = normalizedName(name);
    if (!normalized) continue;
    target.set(normalized, Math.max(
      target.get(normalized) || 0,
      boundedWeight(weight) * scale,
    ));
  }
}

function clipReference(value, defaultLoop = false) {
  return typeof value === "string"
    ? { clip: value, startSeconds: 0, endSeconds: null, loop: defaultLoop }
    : {
      clip: value?.clip || "",
      startSeconds: Math.max(0, Number(value?.startSeconds) || 0),
      endSeconds: Number.isFinite(value?.endSeconds) ? Number(value.endSeconds) : null,
      loop: typeof value?.loop === "boolean" ? value.loop : defaultLoop,
    };
}

class ThreeAvatarPerformer {
  constructor(manifest, gltf) {
    this.manifest = manifest;
    this.canvas = document.createElement("canvas");
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(manifest.environment.background);
    this.camera = new THREE.PerspectiveCamera(manifest.framing.fov, 16 / 9, 0.01, 1000);
    this.camera.position.fromArray(manifest.framing.camera);
    this.camera.lookAt(new THREE.Vector3().fromArray(manifest.framing.target));

    const hemisphere = new THREE.HemisphereLight(0xdde9ff, 0x18312d, manifest.environment.fillLightIntensity);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xffead8, manifest.environment.keyLightIntensity);
    key.position.set(2.2, 3.1, 2.4);
    key.castShadow = true;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x70aaff, manifest.environment.fillLightIntensity * 0.55);
    rim.position.set(-2.4, 2.1, -1.2);
    this.scene.add(rim);

    this.root = gltf.scene;
    this.root.scale.setScalar(manifest.framing.scale);
    const [rotationX = 0, rotationY = 0, rotationZ = 0] =
      manifest.framing.rotationDegrees || [0, 0, 0];
    this.root.rotation.set(
      THREE.MathUtils.degToRad(rotationX),
      THREE.MathUtils.degToRad(rotationY),
      THREE.MathUtils.degToRad(rotationZ),
      "YXZ",
    );
    this.scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = new Map();
    this.#addAnimationClips(gltf.animations);
    this.morphBindings = [];
    this.root.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material?.map) {
          node.material.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }
      }
      if (!node.morphTargetDictionary || !node.morphTargetInfluences) return;
      const targets = new Map();
      for (const [name, index] of Object.entries(node.morphTargetDictionary)) {
        targets.set(normalizedName(name), index);
      }
      this.morphBindings.push({ mesh: node, targets });
    });

    this.head = manifest.nodes.head ? this.root.getObjectByName(manifest.nodes.head) : null;
    this.leftEye = manifest.nodes.leftEye ? this.root.getObjectByName(manifest.nodes.leftEye) : null;
    this.rightEye = manifest.nodes.rightEye ? this.root.getObjectByName(manifest.nodes.rightEye) : null;
    this.neutralRotations = new Map(
      [this.head, this.leftEye, this.rightEye]
        .filter(Boolean)
        .map((node) => [node, node.rotation.clone()]),
    );
    this.currentAction = null;
    this.currentClipName = "";
    this.performanceToken = "";
    this.lastAmbientClip = "";
    this.ambientMode = "";
    this.currentSegment = null;
    this.facialLayers = {
      mood: { action: null, token: "", segment: null },
      viseme: { action: null, token: "", segment: null },
    };
    this.disposed = false;
  }

  addAnimationGltfs(animationGltfs) {
    if (this.disposed) return;
    this.#addAnimationClips(
      animationGltfs.flatMap((animationGltf) => animationGltf.animations),
    );
  }

  resize(width, height) {
    const safeWidth = Math.max(2, Math.round(width));
    const safeHeight = Math.max(2, Math.round(height));
    if (this.canvas.width === safeWidth && this.canvas.height === safeHeight) return;
    this.renderer.setSize(safeWidth, safeHeight, false);
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
  }

  update(state, deltaSeconds) {
    this.#applyMorphs(state, deltaSeconds);
    this.#applyAnimation(state);
    this.#applyFacialAnimation(state);
    this.mixer.update(Math.min(0.1, deltaSeconds));
    this.#enforceClipSegments();
    // Body and facial clips own the base pose. Gaze is a subtle additive
    // correction and must run after the mixer or the next animation tick would
    // overwrite it completely.
    this.#applyGaze(state.gaze, deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.traverse((node) => {
      node.geometry?.dispose?.();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials.filter(Boolean)) {
        for (const value of Object.values(material)) value?.isTexture && value.dispose();
        material.dispose?.();
      }
    });
    this.renderer.dispose();
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  #applyMorphs(state, deltaSeconds) {
    const desired = new Map();
    addMorphWeights(
      desired,
      this.manifest.morphs.moods[state.mood],
      boundedWeight(state.moodLevel),
    );
    addMorphWeights(desired, this.manifest.morphs.visemes[state.viseme], state.speaking ? 1 : 0);
    const blend = 1 - Math.exp(-Math.max(0, deltaSeconds) * (state.speaking ? 24 : 10));
    for (const binding of this.morphBindings) {
      for (const [name, index] of binding.targets) {
        const target = desired.get(name) || 0;
        const current = binding.mesh.morphTargetInfluences[index] || 0;
        binding.mesh.morphTargetInfluences[index] = current + (target - current) * blend;
      }
    }
  }

  #applyGaze(gaze, deltaSeconds) {
    const yaw = gaze === "thought" ? 0.09 : gaze === "target" ? -0.035 : 0;
    const pitch = gaze === "thought" ? -0.025 : 0;
    const blend = 1 - Math.exp(-Math.max(0, deltaSeconds) * 5);
    for (const [node, neutral] of this.neutralRotations) {
      const headScale = node === this.head ? 0.42 : 1;
      node.rotation.x += (neutral.x + pitch * headScale - node.rotation.x) * blend;
      node.rotation.y += (neutral.y + yaw * headScale - node.rotation.y) * blend;
      node.rotation.z += (neutral.z - node.rotation.z) * blend;
    }
  }

  #applyAnimation(state) {
    const gestureClip = state.gesture && state.gesture !== "none"
      ? this.manifest.clips.gestures[state.gesture]
      : null;
    const token = `${state.performanceId}:${state.gesture}`;
    if (gestureClip && token !== this.performanceToken) {
      this.ambientMode = "";
      if (this.#playClip(gestureClip, loopingGestures.has(state.gesture))) {
        this.performanceToken = token;
      }
      return;
    }
    if (gestureClip) return;

    const mode = state.listening ? "listening" : "idle";
    const candidates = mode === "listening"
      ? this.manifest.clips.listening
      : this.manifest.clips.idle;
    const actionFinished = !this.currentAction
      || (this.currentAction.loop === THREE.LoopOnce
        && this.currentAction.time >= this.currentAction.getClip().duration - 0.08);
    if (mode !== this.ambientMode || actionFinished) {
      this.ambientMode = mode;
      const choices = candidates.filter((name) => normalizedName(name) !== this.lastAmbientClip);
      const pool = choices.length ? choices : candidates;
      const next = pool[Math.floor(Math.random() * pool.length)];
      if (next && this.#playClip(next, false)) {
        this.lastAmbientClip = normalizedName(next);
      }
    }
  }

  #applyFacialAnimation(state) {
    const facialClips = this.manifest.facialClips || { moods: {}, visemes: {} };
    const moodReference = facialClips.moods?.[state.mood] || null;
    this.#syncFacialLayer(
      "mood",
      moodReference ? `mood:${state.mood}` : "",
      moodReference,
      boundedWeight(state.moodLevel),
      0.14,
    );
    const visemeReference = state.speaking
      ? facialClips.visemes?.[state.viseme] || null
      : null;
    this.#syncFacialLayer(
      "viseme",
      visemeReference ? `viseme:${state.viseme}` : "",
      visemeReference,
      visemeReference ? 1 : 0,
      0.045,
    );
  }

  #syncFacialLayer(layerName, token, reference, weight, fadeSeconds) {
    const layer = this.facialLayers[layerName];
    if (!reference || weight <= 0.001) {
      if (layer.action) layer.action.fadeOut(fadeSeconds);
      layer.action = null;
      layer.token = "";
      layer.segment = null;
      return;
    }
    if (layer.token === token && layer.action) {
      layer.action.enabled = true;
      layer.action.setEffectiveWeight(weight);
      return;
    }
    const prepared = this.#prepareClip(reference, true);
    if (!prepared) return;
    const previous = layer.action;
    const { action, segment } = prepared;
    action.reset();
    action.time = segment.startSeconds;
    action.enabled = true;
    action.paused = false;
    action.setEffectiveWeight(weight);
    action.setLoop(
      segment.loop && segment.endSeconds === null ? THREE.LoopRepeat : THREE.LoopOnce,
      segment.loop && segment.endSeconds === null ? Infinity : 1,
    );
    action.clampWhenFinished = true;
    if (previous === action) action.play();
    else {
      action.fadeIn(fadeSeconds).play();
      previous?.fadeOut(fadeSeconds);
    }
    layer.action = action;
    layer.token = token;
    layer.segment = segment;
  }

  #addAnimationClips(clips) {
    for (const clip of clips) this.clips.set(normalizedName(clip.name), clip);
  }

  #playClip(reference, defaultLoop) {
    const prepared = this.#prepareClip(reference, defaultLoop);
    if (!prepared) return false;
    const { action, segment, normalized } = prepared;
    const previous = this.currentAction;
    action.reset();
    action.time = segment.startSeconds;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setLoop(
      segment.loop && segment.endSeconds === null ? THREE.LoopRepeat : THREE.LoopOnce,
      segment.loop && segment.endSeconds === null ? Infinity : 1,
    );
    action.clampWhenFinished = true;
    if (previous === action) action.play();
    else {
      action.fadeIn(0.32).play();
      previous?.fadeOut(0.32);
    }
    this.currentAction = action;
    this.currentClipName = normalized;
    this.currentSegment = segment;
    return true;
  }

  #prepareClip(reference, defaultLoop) {
    const segment = clipReference(reference, defaultLoop);
    const normalized = normalizedName(segment.clip);
    const clip = this.clips.get(normalized);
    if (!clip) return null;
    segment.startSeconds = Math.min(segment.startSeconds, clip.duration);
    segment.endSeconds = segment.endSeconds === null
      ? null
      : Math.max(segment.startSeconds, Math.min(segment.endSeconds, clip.duration));
    return { action: this.mixer.clipAction(clip), segment, normalized };
  }

  #enforceClipSegments() {
    this.#enforceActionSegment(this.currentAction, this.currentSegment);
    for (const layer of Object.values(this.facialLayers)) {
      this.#enforceActionSegment(layer.action, layer.segment);
    }
  }

  #enforceActionSegment(action, segment) {
    if (!action || !segment || segment.endSeconds === null) return;
    if (action.time < segment.endSeconds) return;
    if (segment.loop && segment.endSeconds > segment.startSeconds) {
      action.time = segment.startSeconds
        + ((action.time - segment.startSeconds) % (segment.endSeconds - segment.startSeconds));
      action.paused = false;
      return;
    }
    action.time = segment.endSeconds;
    action.paused = true;
  }
}

export async function loadThreeAvatarPerformer(avatarId) {
  const response = await fetch(`/api/performance/avatar/${encodeURIComponent(avatarId)}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Avatar manifest HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest?.schema !== "conclavia.web-avatar" || manifest?.version !== 1) {
    throw new Error("Avatar manifest non compatibile");
  }
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(manifest.model);
  const performer = new ThreeAvatarPerformer(manifest, gltf);
  Promise.all(
    (manifest.animationModels || []).map((model) => loader.loadAsync(model)),
  ).then((animationGltfs) => performer.addAnimationGltfs(animationGltfs)).catch((error) => {
    console.error("Caricamento animazioni Web avatar non riuscito", error);
  });
  return performer;
}
