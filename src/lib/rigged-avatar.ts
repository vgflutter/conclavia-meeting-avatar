import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { finishRiggedMaterial } from "./rigged-avatar-materials";
import type { BusinessAvatarProps } from "@/components/BusinessAvatar";

import { advanceRiggedMouth, advanceRiggedSpring, emptyRiggedMouth, riggedEnergy, riggedIdle,
  RIGGED_VISEMES } from "./rigged-avatar-motion";

/** A skinned character: the clip moves bones; facial targets deform the same mesh. */
export function createRiggedAvatar(gltf: GLTF) {
  const root = gltf.scene;
  const bones = new Map<string, THREE.Bone>();
  const faces: THREE.Mesh[] = [];
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  const chestExpansion = { value: 0 };
  root.traverse(node => {
    if ((node as THREE.Bone).isBone) bones.set(node.name.replace(/^mixamorig:?/u, ""), node as THREE.Bone);
    const object = node as THREE.Mesh;
    if (!object.isMesh) return;
    object.frustumCulled = false;
    // The source lash cards read as individual black spikes at conversation
    // scale. The skin map already supplies a fine lash/brow line underneath.
    if (/eyelashes/u.test(object.name)) object.visible = false;
    object.castShadow = !/eyebrow/u.test(object.name);
    if (/glasses/u.test(object.name) || /Female.*eyebrow/u.test(object.name)) {
      object.geometry.computeBoundingBox();
      const centreY = object.geometry.boundingBox!.getCenter(new THREE.Vector3()).y;
      const glasses = /glasses/u.test(object.name);
      object.geometry.translate(0, -centreY, 0);
      object.geometry.scale(glasses ? .92 : 1, glasses ? .86 : .72, 1);
      object.geometry.translate(0, centreY - (glasses ? 0 : .001), 0);
      if (!glasses) for (const attribute of object.geometry.morphAttributes.position || []) {
        for (let i = 0; i < attribute.count; i++) attribute.setY(i, attribute.getY(i) * .72);
      }
    }
    object.receiveShadow = true;
    geometries.add(object.geometry);
    const positionTargets = object.geometry.morphAttributes.position;
    if (object.name.includes("high-poly") && object.morphTargetInfluences && positionTargets) {
      // The delivered eye mesh only includes horizontal targets. Add a small
      // anatomical downcast by rotating each eyeball around its own centre.
      // This deforms the actual eyes; the face/teeth and original targets stay intact.
      const positions = object.geometry.getAttribute("position");
      const boxes = [new THREE.Box3(), new THREE.Box3()];
      const point = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i); boxes[point.x < 0 ? 0 : 1].expandByPoint(point);
      }
      const centres = boxes.map(box => box.getCenter(new THREE.Vector3()));
      const delta = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i);
        const centre = centres[point.x < 0 ? 0 : 1];
        const y = point.y - centre.y; const z = point.z - centre.z;
        delta[i * 3 + 1] = y * (Math.cos(.075) - 1) - z * Math.sin(.075);
        delta[i * 3 + 2] = y * Math.sin(.075) + z * (Math.cos(.075) - 1);
      }
      const attribute = new THREE.BufferAttribute(delta, 3); attribute.name = "eyeLookDownConclavia";
      const originalTargets = { ...object.morphTargetDictionary };
      positionTargets.push(attribute); object.updateMorphTargets();
      object.morphTargetDictionary = { ...originalTargets, eyeLookDownConclavia: positionTargets.length - 1 };
    }
    if (object.morphTargetDictionary && object.morphTargetInfluences) faces.push(object);
    for (const raw of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(raw);
      const material = raw as THREE.MeshStandardMaterial;
      if (!material.isMeshStandardMaterial) continue;
      const cutout = /hair|short0|bob0|ponytail|eyebrow|eyelash/u.test(material.name);
      material.transparent = false;
      material.depthWrite = true;
      material.alphaTest = /eyebrow|eyelash/u.test(material.name) ? .2 : cutout ? .38 : material.name.includes("high-poly") ? .2 : 0;
      material.alphaToCoverage = material.alphaTest > 0;
      material.side = THREE.DoubleSide;
      for (const value of Object.values(material)) if (value && typeof value === "object" && (value as THREE.Texture).isTexture) {
        const texture = value as THREE.Texture;
        textures.add(texture); texture.anisotropy = 4;
      }
      finishRiggedMaterial(material, !!root.getObjectByName("ConclaviaFemale"), chestExpansion);
      material.needsUpdate = true;
    }
  });
  const clip = gltf.animations[0];
  if (!clip || !bones.has("LeftHand") || !faces.some(m => m.morphTargetDictionary?.viseme_aa !== undefined)) {
    throw new Error("Avatar is missing its skeleton, gesture clip or facial targets");
  }
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play(); action.paused = true;
  mixer.update(0);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(1.78 / bounds.max.y);
  const head = bones.get("Head")!;
  const spine = bones.get("Spine2")!;
  const headRest = head.quaternion.clone();
  const spineRest = spine.quaternion.clone();
  const headScale = head.scale.clone().multiplyScalar(1.085 / 1.18);
  const shoulder = bones.get("LeftShoulder");
  const wrist = bones.get("LeftHand")!;
  const wristSample = wrist.quaternion.clone();
  const wristScale = wrist.scale.clone().multiply(new THREE.Vector3(.92, .95, .98));
  if (root.getObjectByName("ConclaviaFemale")) {
    const cuffGeometry = new THREE.CylinderGeometry(.022, .023, .024, 32);
    const cuffMaterial = new THREE.MeshStandardMaterial({ color: '#cec6b9', roughness: .94, envMapIntensity: .13 });
    const cuff = new THREE.Mesh(cuffGeometry, cuffMaterial); cuff.name = 'ConclaviaShirtCuff';
    cuff.position.y = .002; cuff.castShadow = true; cuff.receiveShadow = true;
    wrist.add(cuff); geometries.add(cuffGeometry); materials.add(cuffMaterial);
  }
  const fingers = [...bones.entries()].filter(([name]) => /^LeftHand(?:Index|Middle|Ring|Pinky|Thumb)[123]$/u.test(name));
  const fingerSamples = new Map(fingers.map(([, bone]) => [bone, bone.quaternion.clone()]));
  const activeArm = bones.get("LeftArm")!;
  const armSample = activeArm.quaternion.clone();
  const parentOrientation = new THREE.Quaternion();
  const armAxis = new THREE.Vector3();
  const rest = new Map<THREE.Bone, THREE.Quaternion>();
  for (const bone of [bones.get("Spine"), bones.get("Spine1"), shoulder, bones.get("RightShoulder")]) {
    if (bone) rest.set(bone, bone.quaternion.clone());
  }
  const hand = bones.get("LeftHand")!;
  const headDelta = new THREE.Quaternion();
  const spineDelta = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const handPosition = new THREE.Vector3();
  let gestureMotion = { position: 0, velocity: 0 };
  let shoulderMotion = { position: 0, velocity: 0 };
  let torsoMotion = { position: 0, velocity: 0 };
  let mouth = emptyRiggedMouth();
  let speech = 0;
  let smile = .16;
  let browInner = 0; let browDown = 0; let browOuter = 0;
  let initialized = false;

  function morph(name: string, weight: number) {
    for (const mesh of faces) {
      const i = mesh.morphTargetDictionary![name];
      if (i !== undefined) mesh.morphTargetInfluences![i] = weight;
    }
  }

  function update(pose: BusinessAvatarProps, seconds: number, dt: number, reducedMotion = false) {
    const targetRaise = pose.gesture === "hand_raise" ? 1 : 0;
    const snap = !initialized || reducedMotion;
    gestureMotion = advanceRiggedSpring(gestureMotion, targetRaise, dt, 10, snap);
    shoulderMotion = advanceRiggedSpring(shoulderMotion, targetRaise, dt, 13, snap);
    torsoMotion = advanceRiggedSpring(torsoMotion, targetRaise, dt, 7, snap);
    initialized = true;
    const raise = THREE.MathUtils.clamp(gestureMotion.position, 0, 1);
    const level = riggedEnergy(pose.voiceLevel);
    const viseme = level ? pose.viseme || "rest" : "rest";
    const speaking = viseme !== "rest";
    const speechTarget = speaking ? 1 : 0;
    const time = Math.min(.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
    speech += (speechTarget - speech) * (1 - Math.exp(-time / (speechTarget > speech ? .18 : .38)));
    const idle = riggedIdle(seconds, speech, raise, reducedMotion);
    action.time = raise * clip.duration;
    // PropertyMixer may skip an unchanged track. Remove our previous wrist
    // overlay before sampling so repeated held poses cannot accumulate twist.
    wrist.quaternion.copy(wristSample);
    activeArm.quaternion.copy(armSample);
    for (const [bone, sample] of fingerSamples) bone.quaternion.copy(sample);
    mixer.update(0);
    for (const [bone, sample] of fingerSamples) sample.copy(bone.quaternion);
    wristSample.copy(wrist.quaternion);
    armSample.copy(activeArm.quaternion);
    // The exported clip enlarges the head by 18%; restore adult proportions on
    // every sample without resizing eyes or distorting the facial morphs.
    head.scale.copy(headScale);
    head.quaternion.copy(headRest);
    spine.quaternion.copy(spineRest);
    for (const [bone, quaternion] of rest) bone.quaternion.copy(quaternion);
    const torso = torsoMotion.position;
    chestExpansion.value = idle.breath;
    spineDelta.setFromEuler(euler.set(.009 * torso, -.012 * torso, .022 * torso));
    spine.quaternion.multiply(spineDelta);
    const lowerSpine = bones.get("Spine1");
    if (lowerSpine) lowerSpine.quaternion.multiply(spineDelta.setFromEuler(euler.set(0, 0, -.009 * torso)));
    if (shoulder) shoulder.quaternion.multiply(spineDelta.setFromEuler(euler.set(0, 0, -.042 * shoulderMotion.position)));
    const otherShoulder = bones.get("RightShoulder");
    if (otherShoulder) otherShoulder.quaternion.multiply(spineDelta.setFromEuler(euler.set(idle.shoulderSettle * .024, 0, -.01 * torso + idle.shoulderSettle * .025)));
    // A relaxed request to speak: an oblique palm and a descending finger arc,
    // rather than a flat, fully splayed stop sign. Restore samples before every
    // mixer evaluation so a held hand never accumulates wrist/finger rotations.
    wrist.scale.copy(wristScale);
    wrist.quaternion.multiply(spineDelta.setFromEuler(euler.set(-.06 * raise, Math.sin(raise * Math.PI) * .065 + .16 * raise, -.04 * raise))).normalize();
    for (const [name, bone] of fingers) {
      const joint = Number(name.at(-1));
      const curl = name.includes('Index') ? .11 : name.includes('Middle') ? .16 : name.includes('Ring') ? .24 : name.includes('Pinky') ? .31 : .09;
      bone.quaternion.multiply(spineDelta.setFromEuler(euler.set(curl * (joint === 1 ? 1 : joint === 2 ? .85 : .5) * raise, 0, name.includes('Thumb') ? .04 * raise : 0))).normalize();
    }
    headDelta.setFromEuler(euler.set(idle.headPitch, idle.headYaw + .008 * torso, -.018 * torso));
    head.quaternion.multiply(headDelta).normalize();
    for (const mesh of faces) mesh.morphTargetInfluences!.fill(0);
    const mood = pose.mood || "neutral";
    const smileTarget = mood === "friendly" ? .38 : mood === "confident" ? .25 : mood === "focused" ? .04 : .16;
    const expressionBlend = reducedMotion ? 1 : 1 - Math.exp(-time / .14);
    smile += (smileTarget * (speaking ? .3 : 1) - smile) * expressionBlend;
    morph("mouthSmileLeft", smile); morph("mouthSmileRight", smile * .96);
    morph("cheekSquintLeft", smile * .18); morph("cheekSquintRight", smile * .18);
    browInner += ((mood === "friendly" ? .06 : 0) - browInner) * expressionBlend;
    browDown += ((mood === "focused" ? .13 : 0) - browDown) * expressionBlend;
    browOuter += ((mood === "confident" ? .09 : 0) - browOuter) * expressionBlend;
    morph("browInnerUp", browInner);
    morph("browDownLeft", browDown); morph("browDownRight", browDown);
    morph("browOuterUpRight", browOuter);
    mouth = advanceRiggedMouth(mouth, viseme, pose.voiceLevel, time);
    for (const [shape, weight] of Object.entries(mouth)) morph(RIGGED_VISEMES[shape as keyof typeof mouth], weight);
    morph("eyeLookDownConclavia", idle.gazeDown);
    const blink = Math.max(idle.blink, idle.gazeDown * .1);
    morph("eyeBlinkLeft", blink); morph("eyeBlinkRight", blink);
    morph("eyeLookInLeft", Math.max(0, idle.gaze)); morph("eyeLookOutRight", Math.max(0, idle.gaze));
    morph("eyeLookOutLeft", Math.max(0, -idle.gaze)); morph("eyeLookInRight", Math.max(0, -idle.gaze));
    root.updateMatrixWorld(true);
    // Bring the middle of the authored arc forward and inward. The original
    // lateral sweep clips fingers at portrait aspect ratios despite fitting at
    // both endpoints. Rotate at the shoulder, preserving lengths and anchors.
    activeArm.parent!.getWorldQuaternion(parentOrientation);
    armAxis.set(0, 1, 0).applyQuaternion(parentOrientation.invert());
    activeArm.quaternion.premultiply(spineDelta.setFromAxisAngle(armAxis, -.9 * Math.sin(raise * Math.PI))).normalize();
    root.updateMatrixWorld(true);
    hand.getWorldPosition(handPosition);
    return { raise, viseme, mouthOpen: speaking && viseme !== "mbp", blink,
      mouthAmplitude: Math.max(mouth.a, mouth.e, mouth.o, mouth.u, mouth.fv, mouth.consonant),
      shoulder: shoulderMotion.position, torso: torsoMotion.position,
      headRotation: head.rotation.toArray().slice(0, 3) as number[], idleAttention: idle.gaze,
      idleAction: idle.action, chestExpansion: chestExpansion.value, shoulderSettle: idle.shoulderSettle,
      torsoRotation: spine.rotation.toArray().slice(0, 3) as number[],
      lowerSpineRotation: bones.get("Spine1")!.rotation.toArray().slice(0, 3) as number[],
      handPosition: handPosition.toArray(), boneCount: bones.size, faceCount: faces.length };
  }

  return { root, bones, update, dispose() {
    mixer.stopAllAction(); mixer.uncacheRoot(root);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) { texture.dispose(); if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) texture.image.close(); }
    root.traverse(object => { if ((object as THREE.SkinnedMesh).isSkinnedMesh) (object as THREE.SkinnedMesh).skeleton.dispose(); });
  } };
}
