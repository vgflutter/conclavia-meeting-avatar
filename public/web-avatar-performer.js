import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

const loopingGestures = new Set(["applause"]);
const gestureWeights = {
  nod: 0.32,
  tilt: 0.24,
  emphasis: 0.32,
  settle: 0.4,
  "raise-hand": 1,
  "lower-hand": 1,
  applause: 1,
};

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
  if (influenceSets < 1) return;
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
    // UE retains up to twelve normalized influences across three accessors.
    // Their quantized sums may slightly exceed one, so the complete set is
    // normalized below before it drives either positions or normals.
    const positionTerms = additionalSets.flatMap((setIndex) => ["x", "y", "z", "w"]
      .map((component) => `conclaviaSkinned += getBoneMatrix(joints_${setIndex}.${component}) * skinVertex * weights_${setIndex}.${component};`))
      .join("\n");
    const normalTerms = additionalSets.flatMap((setIndex) => ["x", "y", "z", "w"]
      .map((component) => `conclaviaSkinMatrix += weights_${setIndex}.${component} * getBoneMatrix(joints_${setIndex}.${component});`))
      .join("\n");
    const additionalWeightTerms = additionalSets
      .map((setIndex) => ` + dot(weights_${setIndex}, vec4(1.0))`)
      .join("");
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <skinning_pars_vertex>",
        `#include <skinning_pars_vertex>\n#ifdef USE_SKINNING\n${declarations}\n#endif`,
      )
      .replace(
        "#include <skinnormal_vertex>",
        `#ifdef USE_SKINNING
float conclaviaNormalWeight = max(dot(skinWeight, vec4(1.0))${additionalWeightTerms}, 0.00001);
mat4 conclaviaSkinMatrix = mat4(0.0);
conclaviaSkinMatrix += skinWeight.x * boneMatX;
conclaviaSkinMatrix += skinWeight.y * boneMatY;
conclaviaSkinMatrix += skinWeight.z * boneMatZ;
conclaviaSkinMatrix += skinWeight.w * boneMatW;
${normalTerms}
conclaviaSkinMatrix /= conclaviaNormalWeight;
conclaviaSkinMatrix = bindMatrixInverse * conclaviaSkinMatrix * bindMatrix;
objectNormal = vec4(conclaviaSkinMatrix * vec4(objectNormal, 0.0)).xyz;
#ifdef USE_TANGENT
objectTangent = vec4(conclaviaSkinMatrix * vec4(objectTangent, 0.0)).xyz;
#endif
#endif`,
      )
      .replace(
        "#include <skinning_vertex>",
        `#ifdef USE_SKINNING
float conclaviaPositionWeight = max(dot(skinWeight, vec4(1.0))${additionalWeightTerms}, 0.00001);
vec4 skinVertex = bindMatrix * vec4(transformed, 1.0);
vec4 conclaviaSkinned = vec4(0.0);
conclaviaSkinned += boneMatX * skinVertex * skinWeight.x;
conclaviaSkinned += boneMatY * skinVertex * skinWeight.y;
conclaviaSkinned += boneMatZ * skinVertex * skinWeight.z;
conclaviaSkinned += boneMatW * skinVertex * skinWeight.w;
${positionTerms}
transformed = (bindMatrixInverse * (conclaviaSkinned / conclaviaPositionWeight)).xyz;
#endif`,
      );
  };
  material.customProgramCacheKey = () => [
    previousCacheKey?.() || "",
    `conclavia-skin-influences-normalized-${influenceSets * 4}`,
  ].join(":");
}

function addFaceCoverageMask(node, material) {
  const position = node.geometry?.getAttribute("position");
  if (!position) return;
  const underlay = new Float32Array(position.count);
  const hidden = new Float32Array(position.count);
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    // The MetaHuman face component includes a garment-independent upper-chest
    // underlay. It is not needed with the meeting shirt and can break through
    // during large shoulder gestures. Keep the authored head and neck, but
    // remove that covered section in immutable bind space.
    underlay[vertex] = position.getY(vertex) < 1.43 ? 1 : 0;
    hidden[vertex] = position.getY(vertex) < 1.405 ? 1 : 0;
  }
  node.geometry.setAttribute("conclaviaFaceUnderlay", new THREE.BufferAttribute(underlay, 1));
  node.geometry.setAttribute("conclaviaFaceHidden", new THREE.BufferAttribute(hidden, 1));
  const previousCompile = material.onBeforeCompile?.bind(material);
  const previousCacheKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile?.(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace(
        "void main() {",
        "attribute float conclaviaFaceUnderlay;\nattribute float conclaviaFaceHidden;\nvarying float vConclaviaFaceHidden;\nvoid main() {\n  vConclaviaFaceHidden = conclaviaFaceHidden;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed -= objectNormal * conclaviaFaceUnderlay * 0.012;",
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      "varying float vConclaviaFaceHidden;\nvoid main() {\n  if (vConclaviaFaceHidden > 0.55) discard;",
    );
  };
  material.customProgramCacheKey = () => [
    previousCacheKey?.() || "",
    "conclavia-face-coverage-hybrid-v1",
  ].join(":");
}

function preparePortableMaterial(node, material, renderer, influenceSets = 1) {
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
  const cardSurface = name.includes("hair_cards")
    || /^WEB_Showcase(?:Hair|Eyebrows)Cards_/u.test(node.name);
  if (cardSurface) {
    // The HQ GLB embeds Epic's native Groom Cards Attribute atlas. Coverage is
    // stored in red rather than alpha, so retain only that data channel and
    // let the material's authored constant color drive the shaded strands.
    // This avoids both the opaque polygon ribbons produced by glTF's Simple
    // material bake and the bald result produced by testing its flat alpha.
    material.alphaTest = 0.065;
    material.alphaHash = false;
    material.alphaToCoverage = true;
    material.transparent = false;
    material.depthWrite = true;
    material.side = THREE.DoubleSide;
    material.envMapIntensity = 0.52;
    material.metalness = 0;
    material.roughness = Math.max(0.56, material.roughness || 0);
    if (material.map) {
      material.map.colorSpace = THREE.NoColorSpace;
      const previousCompile = material.onBeforeCompile?.bind(material);
      const previousCacheKey = material.customProgramCacheKey?.bind(material);
      material.onBeforeCompile = (shader, activeRenderer) => {
        previousCompile?.(shader, activeRenderer);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `vec4 conclaviaGroomAttributes = texture2D(map, vMapUv);
          diffuseColor.a *= conclaviaGroomAttributes.r;`,
        );
      };
      material.customProgramCacheKey = () => [
        previousCacheKey?.() || "",
        "conclavia-native-groom-coverage-red-v1",
      ].join(":");
    }
    if ("specularIntensity" in material) material.specularIntensity = 0.28;
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
    material.envMapIntensity = 0.58;
    material.metalness = 0;
    material.roughness = THREE.MathUtils.clamp(material.roughness || 0.5, 0.42, 0.58);
    if (material.normalScale) material.normalScale.set(1.02, 1.02);
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
    addFaceCoverageMask(node, material);
  } else if (name.includes("body_baked") && influenceSets < 2) {
    // UE's merged body normal texture keeps tangent frames from the source
    // sections; after Skeletal Mesh Merge those frames produce triangular
    // highlights on exposed arms. The high-density body geometry is smooth
    // enough to light directly and looks markedly more photographic without
    // that invalid tangent-space map.
    material.map = null;
    material.normalMap = null;
    material.color = new THREE.Color(0xc9907d);
    material.side = THREE.FrontSide;
    material.envMapIntensity = 0.46;
    material.metalness = 0;
    material.roughness = Math.max(0.58, material.roughness || 0);
  } else if (name.includes("body_baked")) {
    // The meeting-HQ bundle retains 8-12 normalized influences and valid
    // tangent frames. In that path the original skin maps are more detailed
    // than any procedural replacement, especially in the arms and neckline.
    material.side = THREE.FrontSide;
    material.envMapIntensity = 0.5;
    material.metalness = 0;
    material.roughness = THREE.MathUtils.clamp(material.roughness || 0.54, 0.5, 0.64);
    // Native body sections retain their original tangent frames, so their 2K
    // normal atlas is valid again and restores the subtle skin breakup that
    // was lost by the old merged-body workaround.
    if (material.normalScale) material.normalScale.set(0.92, 0.92);
  } else if (name.includes("bodyshapea_shirt") || name.includes("shirt")) {
    // Cloth should read as soft fabric, not as a glossy white polygon shell.
    // The authored color/normal/occlusion maps remain untouched.
    material.side = THREE.FrontSide;
    material.envMapIntensity = 0.24;
    material.metalness = 0;
    material.roughness = Math.max(0.76, material.roughness || 0);
    if (material.normalScale) material.normalScale.set(0.72, 0.72);
  } else if (name.includes("bodyshapea_short")) {
    // This lower garment is fully covered in the half-bust meeting framing.
    // Omitting it prevents a second hidden cloth layer from poking through the
    // T-shirt when arms or shoulders move.
    material.visible = false;
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
    if (/^WEB_Showcase(?:Hair|Eyebrows)Cards_Group\d+_LOD\d+$/u.test(node.name)) {
      cardGroups.push(node);
    }
  });
  if (!cardGroups.length) return;
  root.updateMatrixWorld(true);
  let head = null;
  faceComponent.traverse((node) => {
    if (head || !node.isSkinnedMesh || !node.skeleton?.bones?.length) return;
    const facial = node.skeleton.bones.some((bone) => (
      normalizedNodeName(bone.name) === "facialcfacialroot"
      || normalizedNodeName(bone.name) === "facialroot"
    ));
    if (!facial) return;
    head = node.skeleton.bones.find((bone) => normalizedNodeName(bone.name) === "head") || null;
  });
  // Keep rigid hair cards welded to the animated face skeleton. Object3D.attach
  // preserves the authored world pose while adopting the live head transform.
  const anchor = head || faceComponent;
  for (const group of cardGroups) anchor.attach(group);
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
  const bodyTranslations = [];
  const face = [];
  root.traverse((node) => {
    if (!node.isSkinnedMesh || !node.skeleton?.bones?.length) return;
    const boneNames = new Set(node.skeleton.bones.map((bone) => normalizedNodeName(bone.name)));
    const facial = boneNames.has("facialcfacialroot") || boneNames.has("facialroot");
    const bodySurface = portableMaterials(node).some((material) => (
      String(material.name || "").toLowerCase().includes("body_baked")
    ));
    // The face component contains a duplicate of the complete MetaHuman body
    // chain. Drive both copies from the same body clip so head, hair and neck
    // remain welded to the garment skeleton throughout ambient motion.
    if (boneNames.has("upperarml") && boneNames.has("pelvis")) {
      body.push(...node.skeleton.bones);
      // Translation and scale tracks contain MetaHuman muscle/corrective
      // offsets authored for the naked body skeleton. The wardrobe owns an
      // equivalent but independently bound skeleton: replaying those absolute
      // offsets on it tears the shirt apart during hand raise and applause.
      // Rotations still target every skeleton above; positional correctives
      // deliberately target only the native body surface.
      if (!facial && bodySurface) bodyTranslations.push(...node.skeleton.bones);
    }
    if (facial) face.push(...node.skeleton.bones);
  });
  return {
    body: uniqueNodes(body),
    bodyTranslations: uniqueNodes(bodyTranslations),
    face: uniqueNodes(face),
  };
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

function nodesByNormalizedName(nodes) {
  const index = new Map();
  for (const node of nodes) {
    const name = normalizedNodeName(node.name);
    if (!name) continue;
    const exact = index.get(name) || [];
    exact.push(node);
    index.set(name, exact);
  }
  return index;
}

function trackHasMotion(track, property) {
  const valueSize = track.getValueSize();
  if (!valueSize || track.values.length <= valueSize) return false;
  let maximumDelta = 0;
  for (let offset = valueSize; offset < track.values.length; offset += valueSize) {
    for (let component = 0; component < valueSize; component += 1) {
      maximumDelta = Math.max(
        maximumDelta,
        Math.abs(track.values[offset + component] - track.values[component]),
      );
    }
  }
  const threshold = property === "position" ? 0.00001 : 0.000001;
  return maximumDelta > threshold;
}

function retargetPortableClip(clip, components) {
  const facial = /^asweb(?:mood|viseme)/u.test(normalizedName(clip.name));
  const tracks = [];
  for (const track of clip.tracks) {
    const match = /^(.*)\.(position|quaternion|scale|morphTargetInfluences)$/u.exec(track.name);
    if (!match) {
      tracks.push(track.clone());
      continue;
    }
    const [, sourceName, property] = match;
    if (facial && !normalizedNodeName(sourceName).startsWith("facial")) {
      // UE facial bakes contain a reference copy of every body track. Playing
      // those tracks as a facial layer fights the live body idle/gesture and
      // opens a visible neck seam. Only the dedicated FACIAL_* hierarchy is
      // additive facial performance data.
      continue;
    }
    if (facial && !trackHasMotion(track, property)) {
      // Face Control Rig exports a reference transform for all 875 joints.
      // Replaying those static values as an animation layer moves the complete
      // face away from the live head and creates the extreme neck/eye pose seen
      // during speech. Only joints that actually change belong to the mood or
      // viseme performance.
      continue;
    }
    // Every production body clip in the bundle is baked against this exact
    // Optimized MetaHuman. Preserve authored translations: the applause IK
    // stores its palm-contact correction in the arm-chain position tracks and
    // stripping them makes the hands cross without clapping. MetaHuman also
    // bakes animated scale into its wrist, palm and muscle corrective bones;
    // those tracks shape the hand at contact and are not actor-level scaling.
    // Root motion is rejected by the bundle audit, so these local transforms
    // cannot move camera framing. Keep them on the visible body skeleton only:
    // applying them to the duplicate body chain inside Face would move the
    // head twice and reintroduce the neck/camera regression.
    const bodyCorrection = !facial && (property === "position" || property === "scale");
    if (bodyCorrection && !trackHasMotion(track, property)) continue;
    const exactIndex = facial
      ? components.face
      : bodyCorrection ? components.bodyTranslations : components.body;
    const normalizedIndex = facial
      ? components.normalizedFace
      : bodyCorrection ? components.normalizedBodyTranslations : components.normalizedBody;
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
    this.renderer.toneMappingExposure = 0.94;
    // The compositor already gives this renderer a 2x supersampled target.
    // Keeping the inner renderer at 1 avoids an accidental 4x/8K render on a
    // Retina Mac while preserving the full 2x OBS-quality frame.
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(manifest.environment.background);
    this.environmentTarget = new THREE.PMREMGenerator(this.renderer)
      .fromScene(new RoomEnvironment(), 0.055);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.78;
    this.camera = new THREE.PerspectiveCamera(manifest.framing.fov, 16 / 9, 0.01, 1000);
    this.camera.position.fromArray(manifest.framing.camera);
    this.camera.lookAt(new THREE.Vector3().fromArray(manifest.framing.target));

    RectAreaLightUniformsLib.init();
    const hemisphere = new THREE.HemisphereLight(
      0xfff4ec,
      0x17332f,
      manifest.environment.fillLightIntensity * 0.36,
    );
    this.scene.add(hemisphere);
    const portraitKey = new THREE.RectAreaLight(
      0xffdfcf,
      manifest.environment.keyLightIntensity * 1.2,
      1.65,
      1.95,
    );
    portraitKey.position.set(1.35, 2.45, 1.65);
    portraitKey.lookAt(0, 1.5, 0);
    this.scene.add(portraitKey);
    const portraitFill = new THREE.RectAreaLight(
      0xc8ddff,
      manifest.environment.fillLightIntensity * 0.58,
      1.25,
      1.55,
    );
    portraitFill.position.set(-1.25, 1.85, 1.35);
    portraitFill.lookAt(0, 1.48, 0);
    this.scene.add(portraitFill);
    const key = new THREE.DirectionalLight(
      0xffddca,
      manifest.environment.keyLightIntensity * 0.34,
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
      manifest.environment.fillLightIntensity * 0.16,
    );
    fill.position.set(-1.8, 1.8, 2.7);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(
      0x76a9ff,
      manifest.environment.fillLightIntensity * 0.22,
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
      bodyTranslations: nodesByName(rigNodes.bodyTranslations),
      face: nodesByName(faceNodes),
      normalizedBody: nodesByNormalizedName(bodyNodes),
      normalizedBodyTranslations: nodesByNormalizedName(rigNodes.bodyTranslations),
      normalizedFace: nodesByNormalizedName(faceNodes),
    };
    const bodyNode = (name) => (
      this.animationComponents.bodyTranslations.get(name)?.[0]
      || this.animationComponents.body.get(name)?.[0]
      || null
    );
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
        if (portableMaterials(node).some((material) => (
          String(material.name || "").toLowerCase().includes("bodyshapea_short")
        ))) {
          node.visible = false;
        }
        const influenceSets = [0, 1, 2]
          .filter((index) => node.geometry?.getAttribute(
            index === 0 ? "skinIndex" : `joints_${index}`,
          ) && node.geometry?.getAttribute(
            index === 0 ? "skinWeight" : `weights_${index}`,
          ))
          .length;
        for (const material of portableMaterials(node)) {
          preparePortableMaterial(
            node,
            material,
            this.renderer,
            influenceSets,
          );
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
    this.renderWidth = 0;
    this.renderHeight = 0;
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
        influenceAttributes: [
          "skinIndex",
          "joints_1",
          "joints_2",
          "skinWeight",
          "weights_1",
          "weights_2",
        ].map((name) => {
          const attribute = node.geometry?.getAttribute(name);
          return attribute ? {
            name,
            normalized: attribute.normalized,
            array: attribute.array?.constructor?.name || null,
            first: Array.from(attribute.array.slice(0, 4)),
          } : null;
        }).filter(Boolean),
      });
    });
    return {
      lowerarmL: point(this.bodyRig.lowerarmL),
      handL: point(this.bodyRig.handL),
      lowerarmR: point(this.bodyRig.lowerarmR),
      handR: point(this.bodyRig.handR),
      currentClip: this.currentClipName,
      currentClipTime: this.currentAction
        ? Number(this.currentAction.time.toFixed(3))
        : null,
      skins,
    };
  }

  addAnimationGltfs(animationGltfs) {
    if (this.disposed) return;
    for (const animationGltf of animationGltfs) {
      this.#addAnimationClips(animationGltf.animations);
    }
  }

  resize(width, height) {
    const safeWidth = Math.max(2, Math.round(width));
    const safeHeight = Math.max(2, Math.round(height));
    if (this.renderWidth === safeWidth && this.renderHeight === safeHeight) return;
    this.renderWidth = safeWidth;
    this.renderHeight = safeHeight;
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
    this.#applyApplauseContact(state);
    // Body and facial clips own the base pose. Gaze is a subtle additive
    // correction and must run after the mixer or the next animation tick would
    // overwrite it completely.
    this.#applyGaze(state.gaze, deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  }

  #applyApplauseContact(state) {
    if (state.gesture !== "applause" || !this.bodyRig.handL || !this.bodyRig.handR) return;
    this.root.updateMatrixWorld(true);
    const left = this.bodyRig.handL.getWorldPosition(new THREE.Vector3());
    const right = this.bodyRig.handR.getWorldPosition(new THREE.Vector3());
    const horizontalGap = Math.abs(left.x - right.x);
    // MetaHuman Animator gives us the complete captured arm chain, but a
    // markerless phone take cannot guarantee palm collision after retargeting.
    // Apply a tiny runtime contact constraint only in the closing phase. It
    // preserves the captured arc while preventing fingers from passing through
    // each other, and softly aligns the two palms in depth at the clap.
    const influence = THREE.MathUtils.smoothstep(0.155 - horizontalGap, 0, 0.095);
    if (influence <= 0) return;
    const midpoint = left.clone().add(right).multiplyScalar(0.5);
    const targetGap = 0.088;
    const leftSide = left.x >= right.x ? 1 : -1;
    const leftTarget = left.clone();
    const rightTarget = right.clone();
    leftTarget.x = midpoint.x + leftSide * targetGap * 0.5;
    rightTarget.x = midpoint.x - leftSide * targetGap * 0.5;
    leftTarget.y = THREE.MathUtils.lerp(left.y, midpoint.y, influence * 0.34);
    rightTarget.y = THREE.MathUtils.lerp(right.y, midpoint.y, influence * 0.34);
    leftTarget.z = THREE.MathUtils.lerp(left.z, midpoint.z, influence * 0.58);
    rightTarget.z = THREE.MathUtils.lerp(right.z, midpoint.z, influence * 0.58);
    left.lerp(leftTarget, influence);
    right.lerp(rightTarget, influence);
    this.bodyRig.handL.position.copy(this.bodyRig.handL.parent.worldToLocal(left));
    this.bodyRig.handR.position.copy(this.bodyRig.handR.parent.worldToLocal(right));
    this.root.updateMatrixWorld(true);
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
      if (this.#playClip(
        gestureClip,
        loopingGestures.has(state.gesture),
        gestureWeights[state.gesture] ?? 0.5,
      )) {
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
      if (next && this.#playClip(next, false, 0.5)) {
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
      boundedWeight(state.moodLevel) * 0.48,
      0.24,
    );
    const visemeReference = state.speaking
      ? facialClips.visemes?.[state.viseme] || null
      : null;
    this.#syncFacialLayer(
      "viseme",
      visemeReference ? `viseme:${state.viseme}` : "",
      visemeReference,
      visemeReference ? 0.7 : 0,
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

  #playClip(reference, defaultLoop, weight = 1) {
    const prepared = this.#prepareClip(reference, defaultLoop);
    if (!prepared) return false;
    const { action, segment, normalized } = prepared;
    const previous = this.currentAction;
    action.reset();
    action.time = segment.startSeconds;
    action.enabled = true;
    action.setEffectiveWeight(weight);
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
  // GLTFLoader normalizes only the first four weights on every SkinnedMesh.
  // That is correct for classic glTF, but corrupts UE 5.8's valid JOINTS_1/2
  // extension data: on a twelve-influence garment the first group can carry
  // only a few percent of the total weight. Preserve the quantized source
  // values here; enableExtendedSkinning normalizes all available groups as one.
  const normalizeSkinWeights = THREE.SkinnedMesh.prototype.normalizeSkinWeights;
  THREE.SkinnedMesh.prototype.normalizeSkinWeights = function preserveExtendedWeights() {};
  let gltfs;
  try {
    gltfs = await Promise.all([
      loader.loadAsync(manifest.model),
      ...(manifest.animationModels || []).map((model) => loader.loadAsync(model)),
    ]);
  } finally {
    THREE.SkinnedMesh.prototype.normalizeSkinWeights = normalizeSkinWeights;
  }
  const [gltf, ...animationGltfs] = gltfs;
  const performer = new ThreeAvatarPerformer(manifest, gltf);
  performer.addAnimationGltfs(animationGltfs);
  return performer;
}
