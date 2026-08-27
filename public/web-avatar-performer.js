import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

const loopingGestures = new Set(["applause"]);
const disableMotionForDiagnostics = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("conclaviaMotion") === "off";
const hiddenMeshForDiagnostics = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("conclaviaHide")
  : "";
const inspectSkinForDiagnostics = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("conclaviaDebugSkin") === "1";
const transformModeForDiagnostics = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("conclaviaTransformMode") || "full"
  : "full";
const wardrobeCorrectionMode = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("conclaviaWardrobeCorrection") || "meeting-rig"
  : "meeting-rig";
const wardrobeSkeletonMode = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("conclaviaWardrobeSkeleton") || "shared"
  : "shared";
const wardrobeLimbMode = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("conclaviaWardrobeLimb") || "dynamic"
  : "dynamic";
const skinInfluenceMode = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("conclaviaInfluenceMode") || "extended"
  : "extended";
const hairAlphaThreshold = typeof window !== "undefined"
  ? Number(new URLSearchParams(window.location.search).get("conclaviaHairAlpha") || 0.055)
  : 0.055;
const hairHelmetAlphaThreshold = typeof window !== "undefined"
  ? Number(new URLSearchParams(window.location.search).get("conclaviaHairHelmetAlpha") || 0.05)
  : 0.05;
const raisedHandPresentationMode = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("conclaviaRaisedHandIK") || "on"
  : "on";
const retargetDiagnostics = { matched: 0, missing: 0, transformed: 0, samples: [] };
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

function isWardrobeMesh(node) {
  if (!node?.isSkinnedMesh) return false;
  const names = portableMaterials(node)
    .map((material) => String(material.name || "").toLowerCase());
  return String(node.name || "").toLowerCase().includes("outfit")
    || names.some((name) => name.includes("bodyshapea_"));
}

function wardrobeCorrectiveTarget(name) {
  const match = /_(l|r)$/u.exec(name);
  const side = match?.[1];
  if (!side) return null;
  if (/^upperarm_twistcor_01_/u.test(name)) return `upperarm_twist_01_${side}`;
  if (/^upperarm_(?:twistcor_02|bicep|tricep)_/u.test(name)) {
    return `upperarm_twist_02_${side}`;
  }
  if (/^upperarm_(?:correctiveroot|bck|fwd|in|out)_/u.test(name)) {
    return `upperarm_${side}`;
  }
  if (/^lowerarm_(?:correctiveroot|bck|fwd|in|out)_/u.test(name)) {
    return `lowerarm_${side}`;
  }
  if (/^clavicle_(?:out|scap|pec)_/u.test(name)) return `clavicle_${side}`;
  if (/^spine_04_latissimus_/u.test(name)) return "spine_05";
  return null;
}

function collapseWardrobeCorrectiveJoints(root) {
  if (wardrobeCorrectionMode === "none") return { meshes: 0, joints: 0 };
  let meshes = 0;
  let joints = 0;
  root.traverse((node) => {
    if (!isWardrobeMesh(node) || !node.skeleton?.bones?.length) return;
    const jointByName = new Map(node.skeleton.bones.map((bone, index) => [
      String(bone.name || "").toLowerCase().replace(/_[1-9]$/u, ""),
      index,
    ]));
    const remap = new Map();
    node.skeleton.bones.forEach((bone, index) => {
      const name = String(bone.name || "").toLowerCase().replace(/_[1-9]$/u, "");
      const target = wardrobeCorrectiveTarget(name);
      const targetIndex = target ? jointByName.get(target) : undefined;
      if (targetIndex !== undefined && targetIndex !== index) remap.set(index, targetIndex);
    });
    if (!remap.size) return;
    for (const attributeName of ["skinIndex", "joints_1", "joints_2"]) {
      const attribute = node.geometry?.getAttribute(attributeName);
      if (!attribute) continue;
      for (let vertex = 0; vertex < attribute.count; vertex += 1) {
        for (let component = 0; component < attribute.itemSize; component += 1) {
          const source = Math.round(attribute.getComponent(vertex, component));
          const target = remap.get(source);
          if (target === undefined) continue;
          attribute.setComponent(vertex, component, target);
          joints += 1;
        }
      }
      attribute.needsUpdate = true;
    }
    meshes += 1;
  });
  return { meshes, joints };
}

function meetingWardrobeTarget(name) {
  const side = /_(l|r)$/u.exec(name)?.[1];
  if (/^spine_04_latissimus_/u.test(name)) return "spine_05";
  if (side && /^upperarm(?:_|$)/u.test(name)) return `upperarm_${side}`;
  if (side && /^lowerarm(?:_|$)/u.test(name)) return `lowerarm_${side}`;
  if (side && /^clavicle(?:_|$)/u.test(name)) return `clavicle_${side}`;
  return name;
}

function portableSmoothstep(edge0, edge1, value) {
  const unit = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return unit * unit * (3 - 2 * unit);
}

function applyMeetingWardrobeRig(root) {
  if (wardrobeCorrectionMode !== "meeting-rig") return null;
  let meshes = 0;
  let vertices = 0;
  root.traverse((node) => {
    if (!isWardrobeMesh(node) || !node.skeleton?.bones?.length) return;
    const shirt = portableMaterials(node).some((material) => (
      String(material.name || "").toLowerCase().includes("bodyshapea_shirt")
    ));
    if (!shirt) return;
    const position = node.geometry?.getAttribute("position");
    const influenceSets = [
      [node.geometry?.getAttribute("skinIndex"), node.geometry?.getAttribute("skinWeight")],
      [node.geometry?.getAttribute("joints_1"), node.geometry?.getAttribute("weights_1")],
      [node.geometry?.getAttribute("joints_2"), node.geometry?.getAttribute("weights_2")],
    ].filter(([joints, weights]) => joints && weights);
    if (!position || !influenceSets.length) return;
    const jointByName = new Map(node.skeleton.bones.map((bone, index) => [
      String(bone.name || "").toLowerCase().replace(/_[1-9]$/u, ""),
      index,
    ]));
    const required = [
      "spine_05",
      "spine_04",
      "clavicle_l",
      "clavicle_r",
      "upperarm_l",
      "upperarm_r",
      "lowerarm_l",
      "lowerarm_r",
    ];
    if (required.some((name) => !jointByName.has(name))) return;
    const [baseJoints, baseWeights] = influenceSets[0];
    const authoredInfluenceSets = influenceSets.map(([joints, weights], index) => ({
      jointsAttribute: index === 0 ? "skinIndex" : `joints_${index}`,
      weightsAttribute: index === 0 ? "skinWeight" : `weights_${index}`,
      joints: joints.array.slice(),
      weights: weights.array.slice(),
    }));
    const stableJoints = baseJoints.clone();
    const stableWeights = baseWeights.clone();
    const collapsedInfluences = (vertex) => {
      const collapsed = new Map();
      // Start from Epic's authored garment masks. Only collapse joints whose
      // deformation normally comes from MetaHuman's post-process/cloth graph;
      // those drivers do not exist in Three.js. This keeps the exact sleeve,
      // collar and torso boundaries instead of guessing them from coordinates.
      for (const [joints, weights] of influenceSets) {
        for (let component = 0; component < joints.itemSize; component += 1) {
          const sourceIndex = Math.round(joints.getComponent(vertex, component));
          const weight = weights.getComponent(vertex, component);
          if (weight <= 0) continue;
          const sourceName = String(node.skeleton.bones[sourceIndex]?.name || "")
            .toLowerCase()
            .replace(/_[1-9]$/u, "");
          const targetName = meetingWardrobeTarget(sourceName);
          const targetIndex = jointByName.get(targetName) ?? sourceIndex;
          collapsed.set(targetIndex, (collapsed.get(targetIndex) || 0) + weight);
        }
      }
      // MetaHuman garments intentionally leave large parts of the hem on arm
      // and clavicle correctives because Unreal's cloth pass resolves them.
      // Without that pass the bottom corners fly with a raised arm. Fade those
      // limb weights out below the armpit and return them to the upper torso;
      // authored sleeve and collar masks remain untouched above the blend.
      const limbGates = new Map([
        [jointByName.get("clavicle_l"), 0],
        [jointByName.get("clavicle_r"), 0],
        [jointByName.get("upperarm_l"), 0],
        [jointByName.get("upperarm_r"), 0],
        [jointByName.get("lowerarm_l"), 0],
        [jointByName.get("lowerarm_r"), 0],
      ]);
      let torsoTransfer = 0;
      for (const [joint, limbGate] of limbGates) {
        const weight = collapsed.get(joint) || 0;
        if (weight <= 0) continue;
        const retained = weight * limbGate;
        collapsed.set(joint, retained);
        torsoTransfer += weight - retained;
      }
      const spine = jointByName.get("spine_04");
      collapsed.set(spine, (collapsed.get(spine) || 0) + torsoTransfer);
      const influences = [...collapsed.entries()]
        .filter(([, weight]) => weight > 0.00001)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 4);
      const total = influences.reduce((sum, [, weight]) => sum + weight, 0) || 1;
      return { influences, total };
    };
    const writeInfluences = (vertex, targetJoints, targetWeights, result) => {
      for (let component = 0; component < 4; component += 1) {
        const influence = result.influences[component]
          || [result.influences[0]?.[0] || 0, 0];
        targetJoints.setComponent(vertex, component, influence[0]);
        targetWeights.setComponent(vertex, component, influence[1] / result.total);
      }
    };
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      writeInfluences(
        vertex,
        stableJoints,
        stableWeights,
        collapsedInfluences(vertex),
      );
      for (const [extraJoints, extraWeights] of influenceSets.slice(1)) {
        for (let component = 0; component < extraJoints.itemSize; component += 1) {
          extraJoints.setComponent(vertex, component, 0);
          extraWeights.setComponent(vertex, component, 0);
        }
      }
    }
    node.geometry.setAttribute("skinIndex", stableJoints);
    node.geometry.setAttribute("skinWeight", stableWeights);
    node.userData.conclaviaWardrobeVariants = {
      stable: {
        influenceSets: [
          {
            jointsAttribute: "skinIndex",
            weightsAttribute: "skinWeight",
            joints: stableJoints.array.slice(),
            weights: stableWeights.array.slice(),
          },
          ...influenceSets.slice(1).map(([joints, weights], index) => ({
            jointsAttribute: `joints_${index + 1}`,
            weightsAttribute: `weights_${index + 1}`,
            joints: joints.array.slice(),
            weights: weights.array.slice(),
          })),
        ],
      },
      raised: {
        // The authored Epic weights are the cleanest match for the captured
        // request-to-speak pose. Restore all 12 influences only for that clip;
        // the stable four-influence variant remains active for idle/applause.
        influenceSets: authoredInfluenceSets,
      },
    };
    for (const [joints, weights] of influenceSets.slice(1)) {
      joints.needsUpdate = true;
      weights.needsUpdate = true;
    }
    meshes += 1;
    vertices += position.count;
  });
  return { meshes, vertices };
}

function bodyTransferredWardrobeRig(root) {
  if (wardrobeCorrectionMode !== "body-transfer") return null;
  let body = null;
  const garments = [];
  root.traverse((node) => {
    if (!node.isSkinnedMesh || !node.skeleton?.bones?.length) return;
    const names = portableMaterials(node)
      .map((material) => String(material.name || "").toLowerCase());
    if (!body && names.some((name) => name.includes("mi_body_baked"))) body = node;
    if (names.some((name) => name.includes("bodyshapea_shirt"))) garments.push(node);
  });
  const bodyPosition = body?.geometry?.getAttribute("position");
  const bodyInfluences = body ? [
    [body.geometry.getAttribute("skinIndex"), body.geometry.getAttribute("skinWeight")],
    [body.geometry.getAttribute("joints_1"), body.geometry.getAttribute("weights_1")],
    [body.geometry.getAttribute("joints_2"), body.geometry.getAttribute("weights_2")],
  ].filter(([joints, weights]) => joints && weights) : [];
  if (!body || !bodyPosition || !bodyInfluences.length || !garments.length) return null;

  const cellSize = 0.035;
  const cellKey = (x, y, z) => `${x}:${y}:${z}`;
  const cells = new Map();
  for (let vertex = 0; vertex < bodyPosition.count; vertex += 1) {
    const key = cellKey(
      Math.floor(bodyPosition.getX(vertex) / cellSize),
      Math.floor(bodyPosition.getY(vertex) / cellSize),
      Math.floor(bodyPosition.getZ(vertex) / cellSize),
    );
    const bucket = cells.get(key) || [];
    bucket.push(vertex);
    cells.set(key, bucket);
  }

  let transferredVertices = 0;
  for (const garment of garments) {
    const targetPosition = garment.geometry.getAttribute("position");
    const targetInfluences = [
      [garment.geometry.getAttribute("skinIndex"), garment.geometry.getAttribute("skinWeight")],
      [garment.geometry.getAttribute("joints_1"), garment.geometry.getAttribute("weights_1")],
      [garment.geometry.getAttribute("joints_2"), garment.geometry.getAttribute("weights_2")],
    ].filter(([joints, weights]) => joints && weights);
    if (!targetPosition || !targetInfluences.length) continue;
    const targetJoints = new Map(garment.skeleton.bones.map((bone, index) => [
      normalizedNodeName(bone.name),
      index,
    ]));
    const targetJointsByRigName = new Map(garment.skeleton.bones.map((bone, index) => [
      String(bone.name || "").toLowerCase().replace(/_[1-9]$/u, ""),
      index,
    ]));
    const torsoJoint = targetJointsByRigName.get("spine_04");
    const bodyJointMap = body.skeleton.bones.map((bone) => (
      targetJoints.get(normalizedNodeName(bone.name))
    ));
    for (let vertex = 0; vertex < targetPosition.count; vertex += 1) {
      const x = targetPosition.getX(vertex);
      const y = targetPosition.getY(vertex);
      const z = targetPosition.getZ(vertex);
      const centerX = Math.floor(x / cellSize);
      const centerY = Math.floor(y / cellSize);
      const centerZ = Math.floor(z / cellSize);
      const nearest = [];
      for (let radius = 0; radius <= 3 && nearest.length < 4; radius += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dz = -radius; dz <= radius; dz += 1) {
              if (radius > 0 && Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== radius) {
                continue;
              }
              const candidates = cells.get(cellKey(centerX + dx, centerY + dy, centerZ + dz));
              if (!candidates) continue;
              for (const candidate of candidates) {
                const deltaX = bodyPosition.getX(candidate) - x;
                const deltaY = bodyPosition.getY(candidate) - y;
                const deltaZ = bodyPosition.getZ(candidate) - z;
                nearest.push({
                  vertex: candidate,
                  distanceSquared: deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ,
                });
              }
            }
          }
        }
      }
      nearest.sort((left, right) => left.distanceSquared - right.distanceSquared);
      const samples = nearest.slice(0, 4);
      if (!samples.length) continue;
      const aggregate = new Map();
      for (const sample of samples) {
        const proximity = 1 / Math.max(0.0000001, sample.distanceSquared);
        for (const [joints, weights] of bodyInfluences) {
          for (let component = 0; component < joints.itemSize; component += 1) {
            const sourceJoint = Math.round(joints.getComponent(sample.vertex, component));
            const targetJoint = bodyJointMap[sourceJoint];
            const weight = weights.getComponent(sample.vertex, component);
            if (targetJoint === undefined || weight <= 0) continue;
            aggregate.set(targetJoint, (aggregate.get(targetJoint) || 0) + weight * proximity);
          }
        }
      }
      // A nearest-surface lookup alone can mistake the forearm for the shirt
      // hem around the waist. Collapse MetaHuman corrective families first,
      // then apply an anatomical sleeve gate: below the armpit garment points
      // belong to the torso even when an arm happens to be spatially closer.
      const anatomical = new Map();
      for (const [joint, weight] of aggregate) {
        const sourceName = String(garment.skeleton.bones[joint]?.name || "")
          .toLowerCase()
          .replace(/_[1-9]$/u, "");
        const targetName = meetingWardrobeTarget(sourceName);
        const targetJoint = targetJointsByRigName.get(targetName) ?? joint;
        anatomical.set(targetJoint, (anatomical.get(targetJoint) || 0) + weight);
      }
      const verticalGate = portableSmoothstep(1.0, 1.18, y);
      const horizontal = Math.abs(x);
      let torsoTransfer = 0;
      for (const [joint, weight] of [...anatomical]) {
        const name = String(garment.skeleton.bones[joint]?.name || "")
          .toLowerCase()
          .replace(/_[1-9]$/u, "");
        let limbGate = null;
        if (name.startsWith("clavicle_")) {
          limbGate = verticalGate * portableSmoothstep(0.14, 0.22, horizontal);
        } else if (name.startsWith("upperarm_") || name.startsWith("lowerarm_")) {
          limbGate = verticalGate * portableSmoothstep(0.1, 0.18, horizontal);
        }
        if (limbGate === null) continue;
        anatomical.set(joint, weight * limbGate);
        torsoTransfer += weight * (1 - limbGate);
      }
      if (torsoJoint !== undefined && torsoTransfer > 0) {
        anatomical.set(torsoJoint, (anatomical.get(torsoJoint) || 0) + torsoTransfer);
      }
      const influences = [...anatomical.entries()]
        .filter(([, weight]) => weight > 0.00001)
        .sort((left, right) => right[1] - left[1])
        .slice(0, targetInfluences.length * 4);
      const total = influences.reduce((sum, [, weight]) => sum + weight, 0) || 1;
      for (let setIndex = 0; setIndex < targetInfluences.length; setIndex += 1) {
        const [joints, weights] = targetInfluences[setIndex];
        for (let component = 0; component < joints.itemSize; component += 1) {
          const influence = influences[setIndex * 4 + component]
            || [influences[0]?.[0] || 0, 0];
          joints.setComponent(vertex, component, influence[0]);
          weights.setComponent(vertex, component, influence[1] / total);
        }
      }
      transferredVertices += 1;
    }
    for (const [joints, weights] of targetInfluences) {
      joints.needsUpdate = true;
      weights.needsUpdate = true;
    }
  }
  return { meshes: garments.length, vertices: transferredVertices, source: body.name };
}

function prepareWardrobeRig(root) {
  if (wardrobeCorrectionMode === "body-transfer") return bodyTransferredWardrobeRig(root);
  if (wardrobeCorrectionMode === "meeting-rig") return applyMeetingWardrobeRig(root);
  return collapseWardrobeCorrectiveJoints(root);
}

function extendedSkinDiagnostics(node, limit = 12) {
  if (!node?.isSkinnedMesh || !node.skeleton || !node.geometry) return null;
  const position = node.geometry.getAttribute("position");
  const influenceSets = [
    [node.geometry.getAttribute("skinIndex"), node.geometry.getAttribute("skinWeight")],
    [node.geometry.getAttribute("joints_1"), node.geometry.getAttribute("weights_1")],
    [node.geometry.getAttribute("joints_2"), node.geometry.getAttribute("weights_2")],
  ].filter(([joints, weights]) => joints && weights);
  if (!position || !influenceSets.length) return null;
  node.skeleton.update();
  const source = new THREE.Vector4();
  const transformed = new THREE.Vector4();
  const result = new THREE.Vector4();
  const matrix = new THREE.Matrix4();
  const candidates = [];
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    source.set(position.getX(vertex), position.getY(vertex), position.getZ(vertex), 1)
      .applyMatrix4(node.bindMatrix);
    result.set(0, 0, 0, 0);
    let total = 0;
    const influences = [];
    for (const [joints, weights] of influenceSets) {
      for (let component = 0; component < 4; component += 1) {
        const joint = Math.round(joints.getComponent(vertex, component));
        const weight = weights.getComponent(vertex, component);
        if (weight <= 0) continue;
        matrix.fromArray(node.skeleton.boneMatrices, joint * 16);
        transformed.copy(source).applyMatrix4(matrix).multiplyScalar(weight);
        result.add(transformed);
        total += weight;
        influences.push({
          joint,
          bone: node.skeleton.bones[joint]?.name || String(joint),
          weight: Number(weight.toFixed(5)),
        });
      }
    }
    if (total <= 0) continue;
    result.multiplyScalar(1 / total).applyMatrix4(node.bindMatrixInverse);
    const rest = new THREE.Vector3(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
    const posed = new THREE.Vector3(result.x, result.y, result.z);
    candidates.push({
      vertex,
      distance: posed.distanceTo(rest),
      rest,
      posed,
      influences,
    });
  }
  candidates.sort((left, right) => right.distance - left.distance);
  return {
    vertices: position.count,
    largestDisplacements: candidates.slice(0, limit).map((candidate) => ({
      vertex: candidate.vertex,
      distance: Number(candidate.distance.toFixed(5)),
      rest: candidate.rest.toArray().map((value) => Number(value.toFixed(5))),
      posed: candidate.posed.toArray().map((value) => Number(value.toFixed(5))),
      influences: candidate.influences.map((influence) => {
        const bindPivot = new THREE.Vector3().setFromMatrixPosition(
          node.skeleton.boneInverses[influence.joint].clone().invert(),
        );
        const currentPivot = new THREE.Vector3().setFromMatrixPosition(
          node.skeleton.bones[influence.joint].matrixWorld,
        );
        return {
          bone: influence.bone,
          weight: influence.weight,
          bindPivot: bindPivot.toArray().map((value) => Number(value.toFixed(5))),
          currentPivot: currentPivot.toArray().map((value) => Number(value.toFixed(5))),
        };
      }),
    })),
  };
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
    const x = Math.abs(position.getX(vertex));
    const y = position.getY(vertex);
    underlay[vertex] = y < 1.43 || (y < 1.465 && x > 0.075) ? 1 : 0;
    hidden[vertex] = y < 1.405 || (y < 1.455 && x > 0.08) ? 1 : 0;
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
  const helmetSurface = name.includes("hair_helmet")
    || /^WEB_ShowcaseHairHelmet/u.test(node.name);
  const cardSurface = !helmetSurface && (name.includes("hair_cards")
    || /^WEB_Showcase(?:Hair|Eyebrows)Cards_/u.test(node.name));
  if (helmetSurface) {
    // Epic's low groom LOD uses an opaque helmet below the strand cards. It
    // restores the authored silhouette and bun volume while the Compact card
    // atlas supplies the fine fringe, flyaways and breakup above it.
    material.side = THREE.DoubleSide;
    material.transparent = false;
    // Keep the compact helmet opaque by default: sparse alpha-cut cards alone
    // expose the scalp at meeting distance. Detailed 4K card layers add the
    // hairline and flyaways over this dense authored volume. The threshold is
    // still query-tunable for asset authoring diagnostics.
    material.alphaTest = THREE.MathUtils.clamp(hairHelmetAlphaThreshold, 0, 0.2);
    material.depthWrite = true;
    // Preserve the baked auburn base color instead of multiplying it by a
    // second near-black tint.
    material.color = new THREE.Color(0x8f777a);
    material.envMapIntensity = 0.18;
    material.metalness = 0;
    material.roughness = Math.max(0.82, material.roughness || 0);
  }
  if (cardSurface) {
    const eyebrowSurface = /eyebrow/iu.test(`${node.name} ${material.name || ""}`);
    // The HQ GLB embeds Epic's native Groom Cards Compact Attribute atlas.
    // The Showcase card entries use the Compact layout, where Coverage is
    // authored in red. Green and blue contain non-opacity attributes and must
    // never be merged into the silhouette.
    material.alphaTest = THREE.MathUtils.clamp(hairAlphaThreshold, 0.01, 0.2);
    material.alphaHash = false;
    material.alphaToCoverage = true;
    material.transparent = false;
    material.depthWrite = true;
    material.side = THREE.DoubleSide;
    material.color = new THREE.Color(eyebrowSurface ? 0x3a2421 : 0x7b4147);
    material.envMapIntensity = eyebrowSurface ? 0.22 : 0.25;
    material.metalness = 0;
    material.roughness = Math.max(eyebrowSurface ? 0.74 : 0.72, material.roughness || 0);
    if (material.map) {
      material.map.colorSpace = THREE.NoColorSpace;
      const previousCompile = material.onBeforeCompile?.bind(material);
      const previousCacheKey = material.customProgramCacheKey?.bind(material);
      material.onBeforeCompile = (shader, activeRenderer) => {
        previousCompile?.(shader, activeRenderer);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `vec4 conclaviaGroomCompactAttributes = texture2D(map, vMapUv);
          float conclaviaGroomCoverage = conclaviaGroomCompactAttributes.r;
          diffuseColor.a *= conclaviaGroomCoverage;
          float conclaviaStrandTone = smoothstep(0.08, 0.96, conclaviaGroomCoverage);
          diffuseColor.rgb *= mix(0.74, 1.12, conclaviaStrandTone);`,
        );
      };
      material.customProgramCacheKey = () => [
        previousCacheKey?.() || "",
        `conclavia-native-groom-compact-v4-${eyebrowSurface ? "brow" : "hair"}`,
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
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -2;
    if (material.normalScale) material.normalScale.set(0.72, 0.72);
    // Unreal's garment deformer maintains a tiny clearance over the body.
    // Recreate that clearance in bind space so animated shoulders and collar
    // never z-fight or expose skin through the shirt in the Web renderer.
    const previousCompile = material.onBeforeCompile?.bind(material);
    const previousCacheKey = material.customProgramCacheKey?.bind(material);
    material.onBeforeCompile = (shader, activeRenderer) => {
      previousCompile?.(shader, activeRenderer);
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed += objectNormal * 0.004;",
      );
    };
    material.customProgramCacheKey = () => [
      previousCacheKey?.() || "",
      "conclavia-garment-clearance-v3",
    ].join(":");
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
  enableExtendedSkinning(material, skinInfluenceMode === "top4" ? 1 : influenceSets);
  material.needsUpdate = true;
}

function stabilizePortableHair(root) {
  const faceComponent = root.getObjectByName("Face");
  if (!faceComponent) return;
  const cardGroups = [];
  root.traverse((node) => {
    if (/^WEB_Showcase(?:Hair|HairHelmet|Eyebrows)Cards_Group\d+_LOD\d+$/u.test(node.name)) {
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

function shareWardrobeSkeleton(root) {
  if (wardrobeSkeletonMode === "original") return 0;
  let leader = null;
  const wardrobe = [];
  root.traverse((node) => {
    if (!node.isSkinnedMesh || !node.skeleton?.bones?.length) return;
    const materialNames = portableMaterials(node)
      .map((material) => String(material.name || "").toLowerCase());
    if (materialNames.some((name) => name.includes("mi_body_baked"))) {
      leader ||= node;
    } else if (isWardrobeMesh(node)) {
      wardrobe.push(node);
    }
  });
  if (!leader || !wardrobe.length) return 0;
  const leaderBones = new Map();
  leader.skeleton.bones.forEach((bone, index) => {
    const normalized = normalizedNodeName(bone.name);
    if (!normalized || leaderBones.has(normalized)) return;
    leaderBones.set(normalized, {
      bone,
      inverse: leader.skeleton.boneInverses[index],
    });
  });
  let shared = 0;
  for (const garment of wardrobe) {
    const mapped = garment.skeleton.bones.map((bone) => (
      leaderBones.get(normalizedNodeName(bone.name)) || null
    ));
    const mappedBones = mapped.map((entry) => entry?.bone || null);
    if (mappedBones.some((bone) => !bone)) continue;
    // This is the browser equivalent of Unreal's leader-pose component. Once
    // the garment references the live body bones, its inverse bind matrices
    // must come from those same bones as well. Retaining the garment copy's
    // inverse matrices looks correct only in bind pose; as soon as a shoulder
    // rotates it uses a different pivot and throws sleeve vertices across the
    // torso.
    const skeleton = new THREE.Skeleton(
      mappedBones,
      mapped.map((entry) => entry.inverse.clone()),
    );
    garment.bind(skeleton, garment.bindMatrix.clone());
    shared += 1;
  }
  return shared;
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
  const bodyPositions = [];
  const bodyScales = [];
  const face = [];
  root.traverse((node) => {
    if (!node.isSkinnedMesh || !node.skeleton?.bones?.length) return;
    const boneNames = new Set(node.skeleton.bones.map((bone) => normalizedNodeName(bone.name)));
    const facial = boneNames.has("facialcfacialroot") || boneNames.has("facialroot");
    // The face component contains a duplicate of the complete MetaHuman body
    // chain. Drive both copies from the same body clip so head, hair and neck
    // remain welded to the garment skeleton throughout ambient motion.
    if (boneNames.has("upperarml") && boneNames.has("pelvis")) {
      body.push(...node.skeleton.bones);
      // The v47 exporter restores the wardrobe's authoritative
      // SkinWeightModifier payload. Its shirt is intentionally weighted to
      // MetaHuman corrective joints, so translations and scale must follow the
      // same body clip as rotations or the collar and sleeves separate during
      // hand raise and applause.
      if (!facial) {
        bodyPositions.push(...node.skeleton.bones);
        bodyScales.push(...node.skeleton.bones);
      }
    }
    if (facial) face.push(...node.skeleton.bones);
  });
  return {
    body: uniqueNodes(body),
    bodyPositions: uniqueNodes(bodyPositions),
    bodyScales: uniqueNodes(bodyScales),
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

function sourceAnimationNodes(root) {
  const nodes = [];
  root?.traverse?.((node) => nodes.push(node));
  return {
    exact: nodesByName(nodes),
    normalized: nodesByNormalizedName(nodes),
  };
}

function retargetTransformTrack(track, property, sourceNode, targetNode, clipName = "") {
  const clone = track.clone();
  if (!sourceNode || !targetNode || property === "morphTargetInfluences") return clone;
  retargetDiagnostics.transformed += 1;
  const values = clone.values;
  const size = clone.getValueSize();
  if (property === "position" && size === 3) {
    for (let offset = 0; offset < values.length; offset += size) {
      values[offset] = targetNode.position.x + values[offset] - sourceNode.position.x;
      values[offset + 1] = targetNode.position.y + values[offset + 1] - sourceNode.position.y;
      values[offset + 2] = targetNode.position.z + values[offset + 2] - sourceNode.position.z;
    }
  } else if (property === "scale" && size === 3) {
    const source = sourceNode.scale;
    const target = targetNode.scale;
    for (let offset = 0; offset < values.length; offset += size) {
      values[offset] = target.x * values[offset] / Math.max(0.000001, source.x);
      values[offset + 1] = target.y * values[offset + 1] / Math.max(0.000001, source.y);
      values[offset + 2] = target.z * values[offset + 2] / Math.max(0.000001, source.z);
    }
  } else if (property === "quaternion" && size === 4) {
    const sourceInverse = sourceNode.quaternion.clone().invert();
    const animated = new THREE.Quaternion();
    const delta = new THREE.Quaternion();
    const result = new THREE.Quaternion();
    for (let offset = 0; offset < values.length; offset += size) {
      animated.fromArray(values, offset).normalize();
      delta.copy(sourceInverse).multiply(animated);
      result.copy(targetNode.quaternion).multiply(delta).normalize().toArray(values, offset);
    }
    if (
      inspectSkinForDiagnostics
      && normalizedNodeName(sourceNode.name) === "upperarmtwistcor02r"
      && retargetDiagnostics.samples.length < 64
    ) {
      retargetDiagnostics.samples.push({
        clip: clipName,
        track: track.name,
        sourceRest: sourceNode.quaternion.toArray().map((value) => Number(value.toFixed(6))),
        targetRest: targetNode.quaternion.toArray().map((value) => Number(value.toFixed(6))),
        authoredFirst: Array.from(track.values.slice(0, 4)).map((value) => Number(value.toFixed(6))),
        retargetedFirst: Array.from(values.slice(0, 4)).map((value) => Number(value.toFixed(6))),
        authoredMaximumAngleDegrees: Number(Array.from(
          { length: Math.floor(track.values.length / 4) },
          (_, index) => {
            const offset = index * 4;
            const w = THREE.MathUtils.clamp(Math.abs(track.values[offset + 3]), 0, 1);
            return THREE.MathUtils.radToDeg(2 * Math.acos(w));
          },
        ).reduce((maximum, value) => Math.max(maximum, value), 0).toFixed(3)),
      });
    }
  }
  return clone;
}

function retargetPortableClip(clip, components, sourceRoot = null) {
  const facial = /^asweb(?:mood|viseme)/u.test(normalizedName(clip.name));
  const sourceNodes = sourceAnimationNodes(sourceRoot);
  const tracks = [];
  for (const track of clip.tracks) {
    const match = /^(.*)\.(position|quaternion|scale|morphTargetInfluences)$/u.exec(track.name);
    if (!match) {
      tracks.push(track.clone());
      continue;
    }
    const [, sourceName, property] = match;
    const handRaise = normalizedName(clip.name).includes("meetinghandraise");
    const leftArmTrack = /^(?:clavicle|upperarm|lowerarm|hand|thumb|index|middle|ring|pinky).*_l$/iu
      .test(sourceName);
    // The captured request-to-speak take contains sub-degree markerless noise
    // on the resting arm. Unreal's post-process rig absorbs it, while a raw Web
    // skin can pull the opposite sleeve through the torso. The intent of this
    // one-sided gesture is explicit, so leave the resting chain on the current
    // attentive pose and animate only the raised side.
    if (handRaise && leftArmTrack) continue;
    const sourceNode = (
      sourceNodes.exact.get(sourceName)?.[0]
      || sourceNodes.normalized.get(normalizedNodeName(sourceName))?.[0]
      || null
    );
    if (sourceNode) retargetDiagnostics.matched += 1;
    else retargetDiagnostics.missing += 1;
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
    if (bodyCorrection && transformModeForDiagnostics === "rotation") continue;
    if (bodyCorrection && !trackHasMotion(track, property)) continue;
    const bodyCorrectionIndex = property === "scale"
      ? components.bodyScales
      : components.bodyPositions;
    const normalizedBodyCorrectionIndex = property === "scale"
      ? components.normalizedBodyScales
      : components.normalizedBodyPositions;
    const exactIndex = facial
      ? components.face
      : bodyCorrection ? bodyCorrectionIndex : components.body;
    const normalizedIndex = facial
      ? components.normalizedFace
      : bodyCorrection ? normalizedBodyCorrectionIndex : components.normalizedBody;
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
      // Animation GLBs store absolute local transforms in the source rig's
      // reference pose. MetaHuman body, face and wardrobe duplicate the same
      // named joints but not always the same local rest transform. Replaying
      // source values verbatim tears the garment at corrective joints. Apply
      // the authored delta to each target rest pose instead.
      const clone = retargetTransformTrack(track, property, sourceNode, node, clip.name);
      clone.name = `${node.uuid}.${property}`;
      tracks.push(clone);
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

function rotateBoneDirectionToward(bone, currentDirection, desiredDirection, weight = 1) {
  if (!bone?.parent || currentDirection.lengthSq() < 0.000001 || desiredDirection.lengthSq() < 0.000001) {
    return;
  }
  const current = currentDirection.clone().normalize();
  const desired = desiredDirection.clone().normalize();
  const worldRotation = bone.getWorldQuaternion(new THREE.Quaternion());
  const correction = new THREE.Quaternion().setFromUnitVectors(current, desired);
  const desiredWorld = correction.multiply(worldRotation);
  const parentWorldInverse = bone.parent
    .getWorldQuaternion(new THREE.Quaternion())
    .invert();
  const desiredLocal = parentWorldInverse.multiply(desiredWorld).normalize();
  bone.quaternion.slerp(desiredLocal, THREE.MathUtils.clamp(weight, 0, 1));
}

function solveTwoBonePresentation(root, upperarm, lowerarm, hand, target, elbowHint, weight) {
  if (!upperarm || !lowerarm || !hand || weight <= 0) return;
  root.updateMatrixWorld(true);
  const shoulder = upperarm.getWorldPosition(new THREE.Vector3());
  const elbow = lowerarm.getWorldPosition(new THREE.Vector3());
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  const upperLength = shoulder.distanceTo(elbow);
  const lowerLength = elbow.distanceTo(wrist);
  const toTarget = target.clone().sub(shoulder);
  const maximumReach = Math.max(0.001, upperLength + lowerLength - 0.004);
  const minimumReach = Math.abs(upperLength - lowerLength) + 0.004;
  const distance = THREE.MathUtils.clamp(toTarget.length(), minimumReach, maximumReach);
  const direction = toTarget.normalize();
  const along = (
    upperLength * upperLength
    - lowerLength * lowerLength
    + distance * distance
  ) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const hint = elbowHint.clone().sub(shoulder);
  const perpendicular = hint.addScaledVector(direction, -hint.dot(direction));
  if (perpendicular.lengthSq() < 0.000001) perpendicular.set(0, 0, 1);
  perpendicular.normalize();
  const desiredElbow = shoulder.clone()
    .addScaledVector(direction, along)
    .addScaledVector(perpendicular, height);
  rotateBoneDirectionToward(
    upperarm,
    elbow.clone().sub(shoulder),
    desiredElbow.clone().sub(shoulder),
    weight,
  );
  root.updateMatrixWorld(true);
  const solvedElbow = lowerarm.getWorldPosition(new THREE.Vector3());
  const solvedWrist = hand.getWorldPosition(new THREE.Vector3());
  rotateBoneDirectionToward(
    lowerarm,
    solvedWrist.sub(solvedElbow),
    target.clone().sub(solvedElbow),
    weight,
  );
  root.updateMatrixWorld(true);
}

function boneHierarchyRoot(bone) {
  let root = bone;
  while (root?.parent?.isBone) root = root.parent;
  return root || null;
}

function boneInHierarchy(root, name) {
  if (!root) return null;
  const normalized = normalizedNodeName(name);
  let match = null;
  root.traverse((node) => {
    if (!match && node.isBone && normalizedNodeName(node.name) === normalized) match = node;
  });
  return match;
}

function portableBodyRigs(components) {
  const roots = new Map();
  for (const upperarm of components.normalizedBody.get("upperarmr") || []) {
    const root = boneHierarchyRoot(upperarm);
    if (root) roots.set(root.uuid, root);
  }
  return [...roots.values()].map((root) => ({
    root,
    headBody: boneInHierarchy(root, "head"),
    upperarmL: boneInHierarchy(root, "upperarm_l"),
    lowerarmL: boneInHierarchy(root, "lowerarm_l"),
    handL: boneInHierarchy(root, "hand_l"),
    upperarmR: boneInHierarchy(root, "upperarm_r"),
    lowerarmR: boneInHierarchy(root, "lowerarm_r"),
    handR: boneInHierarchy(root, "hand_r"),
    middleFingerR: boneInHierarchy(root, "middle_metacarpal_r")
      || boneInHierarchy(root, "middle_01_r"),
  })).filter((rig) => rig.upperarmR && rig.lowerarmR && rig.handR);
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
    this.wardrobeCorrection = prepareWardrobeRig(this.root);
    this.sharedWardrobeMeshes = shareWardrobeSkeleton(this.root);
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
      bodyPositions: nodesByName(rigNodes.bodyPositions),
      bodyScales: nodesByName(rigNodes.bodyScales),
      face: nodesByName(faceNodes),
      normalizedBody: nodesByNormalizedName(bodyNodes),
      normalizedBodyPositions: nodesByNormalizedName(rigNodes.bodyPositions),
      normalizedBodyScales: nodesByNormalizedName(rigNodes.bodyScales),
      normalizedFace: nodesByNormalizedName(faceNodes),
    };
    const faceNode = (name) => this.animationComponents.normalizedFace.get(name)?.[0] || null;
    // MetaHuman body, face and wardrobe meshes can carry duplicate skeleton
    // hierarchies. Animation tracks already target every copy; presentation
    // corrections must do the same or the skin moves while a shirt sleeve is
    // left in the authored pose.
    this.bodyRigs = portableBodyRigs(this.animationComponents);
    this.bodyRig = this.bodyRigs[0] || {};
    this.bodyRig.headFace = faceNode("head");
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = new Map();
    this.#addAnimationClips(gltf.animations, gltf.scene);
    this.morphBindings = [];
    this.wardrobeMeshes = [];
    this.wardrobePoseMode = "";
    this.root.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (portableMaterials(node).some((material) => (
          String(material.name || "").toLowerCase().includes("bodyshapea_short")
        ))) {
          node.visible = false;
        }
        if (
          hiddenMeshForDiagnostics === "body"
          && portableMaterials(node).some((material) => (
            String(material.name || "").toLowerCase().includes("mi_body_baked")
          ))
        ) {
          node.visible = false;
        }
        if (hiddenMeshForDiagnostics === "wardrobe" && isWardrobeMesh(node)) {
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
        if (node.userData.conclaviaWardrobeVariants) this.wardrobeMeshes.push(node);
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
    this.raisePresentationWeight = 0;
    this.disposed = false;
  }

  diagnostics() {
    this.root.updateMatrixWorld(true);
    const point = (node) => node
      ? node.getWorldPosition(new THREE.Vector3()).toArray().map((value) => Number(value.toFixed(4)))
      : null;
    const rotation = (node) => node
      ? node.getWorldQuaternion(new THREE.Quaternion()).toArray().map((value) => Number(value.toFixed(4)))
      : null;
    const skins = [];
    let wardrobeSkin = null;
    this.root.traverse((node) => {
      if (!node.isSkinnedMesh) return;
      if (
        inspectSkinForDiagnostics
        && !wardrobeSkin
        && portableMaterials(node).some((material) => (
          String(material.name || "").toLowerCase().includes("bodyshapea_shirt")
        ))
      ) {
        wardrobeSkin = extendedSkinDiagnostics(node);
      }
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
      upperarmL: point(this.bodyRig.upperarmL),
      handL: point(this.bodyRig.handL),
      lowerarmR: point(this.bodyRig.lowerarmR),
      upperarmR: point(this.bodyRig.upperarmR),
      handR: point(this.bodyRig.handR),
      headBody: point(this.bodyRig.headBody),
      headFace: point(this.bodyRig.headFace),
      headBodyRotation: rotation(this.bodyRig.headBody),
      headFaceRotation: rotation(this.bodyRig.headFace),
      currentClip: this.currentClipName,
      currentClipTime: this.currentAction
        ? Number(this.currentAction.time.toFixed(3))
        : null,
      retarget: { ...retargetDiagnostics },
      wardrobeCorrection: this.wardrobeCorrection,
      sharedWardrobeMeshes: this.sharedWardrobeMeshes,
      wardrobeSkin,
      skins,
    };
  }

  addAnimationGltfs(animationGltfs) {
    if (this.disposed) return;
    for (const animationGltf of animationGltfs) {
      this.#addAnimationClips(animationGltf.animations, animationGltf.scene);
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
    this.#syncWardrobePose(state);
    this.#applyMorphs(state, deltaSeconds);
    if (!disableMotionForDiagnostics) this.#applyAnimation(state);
    this.#applyFacialAnimation(state);
    this.mixer.update(Math.min(0.1, deltaSeconds));
    this.#enforceClipSegments();
    this.#applyRaisedHandPresentation(state, deltaSeconds);
    this.#applyApplauseContact(state);
    // Body and facial clips own the base pose. Gaze is a subtle additive
    // correction and must run after the mixer or the next animation tick would
    // overwrite it completely.
    this.#applyGaze(state.gaze, deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  }

  #syncWardrobePose(state) {
    const nextMode = wardrobeLimbMode === "stable"
      ? "stable"
      : wardrobeLimbMode === "adaptive" || state.gesture === "applause"
        ? "stable"
        : "raised";
    if (nextMode === this.wardrobePoseMode) return;
    for (const mesh of this.wardrobeMeshes) {
      const variant = mesh.userData.conclaviaWardrobeVariants?.[nextMode];
      if (!variant?.influenceSets) continue;
      for (const influenceSet of variant.influenceSets) {
        const joints = mesh.geometry?.getAttribute(influenceSet.jointsAttribute);
        const weights = mesh.geometry?.getAttribute(influenceSet.weightsAttribute);
        if (!joints?.array || !weights?.array) continue;
        joints.array.set(influenceSet.joints);
        weights.array.set(influenceSet.weights);
        joints.needsUpdate = true;
        weights.needsUpdate = true;
      }
    }
    this.wardrobePoseMode = nextMode;
  }

  #applyRaisedHandPresentation(state, deltaSeconds) {
    if (raisedHandPresentationMode === "off") return;
    const raised = state.gesture === "raise-hand";
    this.raisePresentationWeight = THREE.MathUtils.damp(
      this.raisePresentationWeight,
      raised ? 1 : 0,
      raised ? 8 : 12,
      Math.max(0, deltaSeconds),
    );
    if (this.raisePresentationWeight < 0.001 || !this.bodyRig.headBody) return;
    this.root.updateMatrixWorld(true);
    const head = this.bodyRig.headBody.getWorldPosition(new THREE.Vector3());
    // Keep the captured gesture and use a compact two-bone presentation solve
    // only to place the palm in the visible meeting plane. This prevents a
    // markerless take from retargeting behind the shoulder while preserving
    // its authored elbow arc, wrist pose and transition timing.
    // Keep both joints close to the coronal plane of the torso. A deep
    // positive Z target pushes the forearm toward a perspective camera and
    // makes it look enormous; the compact offsets below bring the palm just
    // in front of the shoulder without changing the meeting-camera scale.
    const target = head.clone().add(new THREE.Vector3(-0.34, -0.02, 0.03));
    const elbowHint = head.clone().add(new THREE.Vector3(-0.34, -0.45, -0.10));
    for (const rig of this.bodyRigs) {
      solveTwoBonePresentation(
        this.root,
        rig.upperarmR,
        rig.lowerarmR,
        rig.handR,
        target,
        elbowHint,
        this.raisePresentationWeight * 0.88,
      );
      if (!rig.middleFingerR) continue;
      this.root.updateMatrixWorld(true);
      const wrist = rig.handR.getWorldPosition(new THREE.Vector3());
      const middleFinger = rig.middleFingerR.getWorldPosition(new THREE.Vector3());
      rotateBoneDirectionToward(
        rig.handR,
        middleFinger.sub(wrist),
        new THREE.Vector3(0, 1, 0),
        this.raisePresentationWeight * 0.82,
      );
      this.root.updateMatrixWorld(true);
    }
  }

  #applyApplauseContact(state) {
    if (state.gesture !== "applause") return;
    for (const rig of this.bodyRigs) {
      if (!rig.handL || !rig.handR) continue;
      this.root.updateMatrixWorld(true);
      const left = rig.handL.getWorldPosition(new THREE.Vector3());
      const right = rig.handR.getWorldPosition(new THREE.Vector3());
      const horizontalGap = Math.abs(left.x - right.x);
      // MetaHuman Animator gives us the complete captured arm chain, but a
      // markerless phone take cannot guarantee palm collision after retargeting.
      // Apply a tiny runtime contact constraint only in the closing phase. It
      // preserves the captured arc while preventing fingers from passing through
      // each other, and softly aligns the two palms in depth at the clap.
      const influence = 1 - THREE.MathUtils.smoothstep(horizontalGap, 0.31, 0.39);
      if (influence <= 0) continue;
      const midpoint = left.clone().add(right).multiplyScalar(0.5);
      // Hand-bone origins sit inside each palm: 10.5 cm brings the visible palm
      // surfaces into contact without making fingers cross through each other.
      // The previous 28.5 cm target visibly left both hands floating.
      const targetGap = 0.105;
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
      rig.handL.position.copy(rig.handL.parent.worldToLocal(left));
      rig.handR.position.copy(rig.handR.parent.worldToLocal(right));
      this.root.updateMatrixWorld(true);
    }
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

  #addAnimationClips(clips, sourceRoot) {
    for (const clip of clips) {
      this.clips.set(
        normalizedName(clip.name),
        retargetPortableClip(clip, this.animationComponents, sourceRoot),
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
