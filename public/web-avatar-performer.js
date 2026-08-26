import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const loopingGestures = new Set(["applause"]);

function normalizedName(value) {
  return String(value || "").trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

function normalizedNodeName(value) {
  // GLTFLoader makes duplicate node names globally unique (`upperarm_l_1`,
  // `upperarm_l_2`). Those suffixes identify the face and wardrobe copies of
  // the same MetaHuman joint; they are not part of the skeleton contract.
  return normalizedName(String(value || "").replace(/_[1-9]$/u, ""));
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

function portableMaterials(node) {
  if (!node?.material) return [];
  return Array.isArray(node.material) ? node.material : [node.material];
}

function enableExtendedSkinning(material, influenceSets) {
  if (influenceSets < 2) return;
  const additionalSets = Array.from(
    { length: Math.min(3, influenceSets) - 1 },
    (_, index) => index + 1,
  );
  const previousCompile = material.onBeforeCompile?.bind(material);
  const previousCacheKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile?.(shader, renderer);
    const declarations = additionalSets
      .map((setIndex) => `attribute vec4 joints_${setIndex};\nattribute vec4 weights_${setIndex};`)
      .join("\n");
    const positionTerms = additionalSets.flatMap((setIndex) => ["x", "y", "z", "w"]
      .map((component) => `conclaviaSkinned += getBoneMatrix(joints_${setIndex}.${component}) * skinVertex * weights_${setIndex}.${component};`))
      .join("\n");
    const normalTerms = additionalSets.flatMap((setIndex) => ["x", "y", "z", "w"]
      .map((component) => `conclaviaSkinMatrix += weights_${setIndex}.${component} * getBoneMatrix(joints_${setIndex}.${component});`))
      .join("\n");
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <skinning_pars_vertex>",
        `#include <skinning_pars_vertex>\n#ifdef USE_SKINNING\n${declarations}\n#endif`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nvec3 conclaviaBaseObjectNormal = objectNormal;",
      )
      .replace(
        "#include <skinnormal_vertex>",
        `#include <skinnormal_vertex>
#ifdef USE_SKINNING
mat4 conclaviaSkinMatrix = mat4(0.0);
${normalTerms}
objectNormal += (bindMatrixInverse * conclaviaSkinMatrix * bindMatrix * vec4(conclaviaBaseObjectNormal, 0.0)).xyz;
#endif`,
      )
      .replace(
        "#include <skinning_vertex>",
        `#include <skinning_vertex>
#ifdef USE_SKINNING
vec4 conclaviaSkinned = vec4(0.0);
${positionTerms}
transformed += (bindMatrixInverse * conclaviaSkinned).xyz;
#endif`,
      );
  };
  material.customProgramCacheKey = () => [
    previousCacheKey?.() || "",
    `conclavia-skin-influences-${influenceSets * 4}`,
  ].join(":");
}

function preparePortableMaterial(material, renderer, influenceSets = 1) {
  for (const texture of [
    material.map,
    material.normalMap,
    material.roughnessMap,
    material.metalnessMap,
    material.aoMap,
    material.emissiveMap,
  ]) {
    if (texture) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  const name = String(material.name || "").toLowerCase();
  if (name.includes("hair_cards")) {
    // Unreal's baked cards atlas quantizes the authored threshold at the edge
    // of the mask. A low deterministic cutoff preserves the fine strands; a
    // higher runtime override makes the hairstyle disappear entirely.
    material.alphaTest = 0.05;
    material.transparent = false;
    material.depthWrite = true;
    material.side = THREE.DoubleSide;
    material.envMapIntensity = 0.22;
    material.metalness = 0;
    material.roughness = Math.max(0.62, material.roughness || 0);
    if ("specularIntensity" in material) material.specularIntensity = 0.32;
  }
  if (name.includes("face_skin_baked_lod1") && material.map) {
    // Keep the high-frequency identity texture and normal response visible.
    // A tiny texture fill only compensates for MetaHuman subsurface scattering,
    // which glTF PBR cannot represent; the previous 0.35 emissive workaround
    // flattened pores, specular breakup and facial volume.
    material.aoMap = null;
    material.emissiveMap = material.map;
    material.emissive = new THREE.Color(0xffffff);
    material.emissiveIntensity = 0.075;
    material.envMapIntensity = 0.52;
    material.metalness = 0;
    if (material.normalScale) material.normalScale.set(1.08, 1.08);
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        float conclaviaSkinEdge = pow(
          1.0 - saturate(dot(geometryNormal, geometryViewDir)),
          2.0
        );
        reflectedLight.indirectDiffuse += diffuseColor.rgb
          * vec3(1.0, 0.34, 0.22)
          * conclaviaSkinEdge
          * 0.055;`,
      );
    };
    material.customProgramCacheKey = () => "conclavia-skin-hq-v1";
  } else if (name.includes("eyel_baked") || name.includes("eyer_baked")) {
    material.envMapIntensity = 0.88;
    material.roughness = Math.max(0.18, material.roughness || 0);
  } else if (material.isMeshStandardMaterial) {
    material.envMapIntensity = 0.62;
  }
  enableExtendedSkinning(material, influenceSets);
  material.needsUpdate = true;
}

function stabilizePortableHair(root) {
  const faceComponent = root.getObjectByName("Face");
  if (!faceComponent) return;
  const cardGroups = [];
  root.traverse((node) => {
    if (/^WEB_ShowcaseHairCards_Group\d+_LOD\d+$/u.test(node.name)) {
      cardGroups.push(node);
    }
  });
  if (!cardGroups.length) return;
  root.updateMatrixWorld(true);
  // UE exports rigid cards attached to the body skeleton's `head` bone. The
  // separately baked Web body clips and MetaHuman face rig do not share that
  // component-space head transform, so Three.js would drag the hairstyle down
  // over the mouth as soon as the first idle starts. Keep the cards on the
  // Face component while preserving their authored world transform.
  for (const group of cardGroups) faceComponent.attach(group);
  root.updateMatrixWorld(true);
}

function componentNodes(component, excludedRoots = new Set()) {
  const nodes = [];
  const visit = (node) => {
    if (!node || excludedRoots.has(node)) return;
    nodes.push(node);
    for (const child of node.children || []) visit(child);
  };
  visit(component);
  return nodes;
}

function uniqueNodes(nodes) {
  const seen = new Set();
  return nodes.filter((node) => {
    if (!node || seen.has(node.uuid)) return false;
    seen.add(node.uuid);
    return true;
  });
}

function portableRigNodes(root) {
  const body = [];
  const face = [];
  root.traverse((node) => {
    if (!node.isSkinnedMesh || !node.skeleton?.bones?.length) return;
    const boneNames = new Set(node.skeleton.bones.map((bone) => normalizedNodeName(bone.name)));
    if (boneNames.has("upperarml") && boneNames.has("pelvis")) {
      body.push(...node.skeleton.bones);
    }
    if (boneNames.has("facialcfacialroot") || boneNames.has("facialroot")) {
      face.push(...node.skeleton.bones);
    }
  });
  return { body: uniqueNodes(body), face: uniqueNodes(face) };
}

function nodesByName(nodes) {
  const index = new Map();
  for (const node of nodes) {
    if (!node.name) continue;
    const exact = index.get(node.name) || [];
    exact.push(node);
    index.set(node.name, exact);
  }
  return index;
}

function retargetPortableClip(clip, components) {
  const facial = /^asweb(?:mood|viseme)/u.test(normalizedName(clip.name));
  const exactIndex = facial ? components.face : components.body;
  const normalizedIndex = facial ? components.normalizedFace : components.normalizedBody;
  const tracks = [];
  for (const track of clip.tracks) {
    const match = /^(.*)\.(position|quaternion|scale|morphTargetInfluences)$/u.exec(track.name);
    if (!match) {
      tracks.push(track.clone());
      continue;
    }
    const [, sourceName, property] = match;
    // Body animation assets may carry the reference translations of the
    // authoring skeleton. MetaHuman Optimized bodies keep the same joint
    // topology but can have different limb lengths, so replaying those local
    // translations opens visible gaps at the shoulder, elbow and wrist.
    // Rotations preserve the target avatar's own bind proportions and are the
    // correct retargeting primitive for portable body gestures.
    if (!facial && (property === "position" || property === "scale")) continue;
    // Merge exact and normalized names to tolerate GLTFLoader's duplicate-name
    // suffixes while targeting only the body or face component selected above.
    const candidates = [
      ...(exactIndex.get(sourceName) || []),
      ...(normalizedIndex.get(normalizedNodeName(sourceName)) || []),
    ];
    if (!candidates.length) continue;
    const seen = new Set();
    for (const node of candidates) {
      if (seen.has(node.uuid)) continue;
      seen.add(node.uuid);
      const clone = track.clone();
      clone.name = `${node.uuid}.${property}`;
      tracks.push(clone);
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
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
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(manifest.environment.background);
    this.environmentTarget = new THREE.PMREMGenerator(this.renderer)
      .fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.72;
    this.camera = new THREE.PerspectiveCamera(manifest.framing.fov, 16 / 9, 0.01, 1000);
    this.camera.position.fromArray(manifest.framing.camera);
    this.camera.lookAt(new THREE.Vector3().fromArray(manifest.framing.target));

    const hemisphere = new THREE.HemisphereLight(
      0xffeee4,
      0x17332f,
      manifest.environment.fillLightIntensity * 0.58,
    );
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(
      0xffddca,
      manifest.environment.keyLightIntensity * 0.76,
    );
    key.position.set(2.2, 3.1, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.bias = -0.00008;
    key.shadow.normalBias = 0.018;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -1;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(
      0xfff1e8,
      manifest.environment.fillLightIntensity * 0.38,
    );
    fill.position.set(-1.8, 1.8, 2.7);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(
      0x76a9ff,
      manifest.environment.fillLightIntensity * 0.32,
    );
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
    stabilizePortableHair(this.root);
    const rigNodes = portableRigNodes(this.root);
    const bodyComponent = this.root.getObjectByName("Body");
    const faceComponent = this.root.getObjectByName("Face");
    const duplicateBodyComponent = this.root.getObjectByName("SkeletalMesh");
    // Read the actual skeleton bindings first. Skeletal Mesh Merge is free to
    // rename the exported component, while the authored MetaHuman bone
    // contract remains stable. Keep the component walk only as a compatibility
    // fallback for older v38-v40 bundles.
    const bodyNodes = rigNodes.body.length
      ? rigNodes.body
      : componentNodes(
        bodyComponent,
        new Set([faceComponent, duplicateBodyComponent].filter(Boolean)),
      );
    const faceNodes = rigNodes.face.length ? rigNodes.face : componentNodes(faceComponent);
    this.animationComponents = {
      body: nodesByName(bodyNodes),
      face: nodesByName(faceNodes),
      normalizedBody: nodesByName(bodyNodes.map((node) => ({
        name: normalizedNodeName(node.name),
        uuid: node.uuid,
      }))),
      normalizedFace: nodesByName(faceNodes.map((node) => ({
        name: normalizedNodeName(node.name),
        uuid: node.uuid,
      }))),
    };
    const bodyNode = (name) => this.animationComponents.body.get(name)?.[0] || null;
    this.bodyRig = {
      lowerarmL: bodyNode("lowerarm_l"),
      handL: bodyNode("hand_l"),
      lowerarmR: bodyNode("lowerarm_r"),
      handR: bodyNode("hand_r"),
    };
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = new Map();
    this.#addAnimationClips(gltf.animations);
    this.morphBindings = [];
    this.root.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        const influenceSets = [0, 1, 2]
          .filter((index) => node.geometry?.getAttribute(
            index === 0 ? "skinIndex" : `joints_${index}`,
          ) && node.geometry?.getAttribute(
            index === 0 ? "skinWeight" : `weights_${index}`,
          ))
          .length;
        for (const material of portableMaterials(node)) {
          preparePortableMaterial(material, this.renderer, influenceSets);
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

  diagnostics() {
    this.root.updateMatrixWorld(true);
    const point = (node) => node
      ? node.getWorldPosition(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(4)))
      : null;
    const skins = [];
    this.root.traverse((node) => {
      if (!node.isSkinnedMesh) return;
      skins.push({
        name: node.name,
        parent: node.parent?.name || null,
        bones: node.skeleton?.bones.length || 0,
        firstBone: node.skeleton?.bones[0]?.name || null,
        bindMatrix: node.bindMatrix.elements.map((value) => Number(value.toFixed(4))),
        worldMatrix: node.matrixWorld.elements.map((value) => Number(value.toFixed(4))),
        materials: portableMaterials(node).map((material) => material.name || ""),
      });
    });
    return {
      lowerarmL: point(this.bodyRig.lowerarmL),
      handL: point(this.bodyRig.handL),
      lowerarmR: point(this.bodyRig.lowerarmR),
      handR: point(this.bodyRig.handR),
      skins,
    };
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
    this.environmentTarget?.dispose();
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
      0.24,
    );
    const visemeReference = state.speaking
      ? facialClips.visemes?.[state.viseme] || null
      : null;
    this.#syncFacialLayer(
      "viseme",
      visemeReference ? `viseme:${state.viseme}` : "",
      visemeReference,
      visemeReference ? 1 : 0,
      0.06,
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
    for (const clip of clips) {
      this.clips.set(
        normalizedName(clip.name),
        retargetPortableClip(clip, this.animationComponents),
      );
    }
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
      action.fadeIn(0.46).play();
      previous?.fadeOut(0.56);
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
  const [gltf, ...animationGltfs] = await Promise.all([
    loader.loadAsync(manifest.model),
    ...(manifest.animationModels || []).map((model) => loader.loadAsync(model)),
  ]);
  const performer = new ThreeAvatarPerformer(manifest, gltf);
  performer.addAnimationGltfs(animationGltfs);
  return performer;
}
