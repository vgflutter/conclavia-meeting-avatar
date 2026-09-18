import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { BusinessAvatarProps } from "@/components/BusinessAvatar";

const VISEMES = { rest: "", mbp: "viseme_PP", fv: "viseme_FF", a: "viseme_aa",
  e: "viseme_E", o: "viseme_O", u: "viseme_U", consonant: "viseme_DD" } as const;

/** A skinned character: the clip moves bones; facial targets deform the same mesh. */
export function createRiggedAvatar(gltf: GLTF) {
  const root = gltf.scene;
  const bones = new Map<string, THREE.Bone>();
  const faces: THREE.Mesh[] = [];
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  root.traverse(node => {
    if ((node as THREE.Bone).isBone) bones.set(node.name.replace(/^mixamorig:?/u, ""), node as THREE.Bone);
    const object = node as THREE.Mesh;
    if (!object.isMesh) return;
    object.frustumCulled = false;
    object.castShadow = true;
    object.receiveShadow = true;
    geometries.add(object.geometry);
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
      material.roughness = material.name.includes("high-poly") ? .45 : material.name.endsWith("body") ? .72 : .82;
      material.envMapIntensity = .3;
      if (material.name.includes("bob02")) material.color.set("#624231");
      if (material.name.endsWith("body")) material.color.set("#f0d5c1");
      for (const value of Object.values(material)) if (value && typeof value === "object" && (value as THREE.Texture).isTexture) {
        const texture = value as THREE.Texture;
        textures.add(texture); texture.anisotropy = 4;
      }
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
  const hand = bones.get("LeftHand")!;
  const headDelta = new THREE.Quaternion();
  const spineDelta = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const handPosition = new THREE.Vector3();
  let raise = 0;
  let initialized = false;

  function morph(name: string, weight: number) {
    for (const mesh of faces) {
      const i = mesh.morphTargetDictionary![name];
      if (i !== undefined) mesh.morphTargetInfluences![i] = weight;
    }
  }

  function update(pose: BusinessAvatarProps, seconds: number, dt: number, reducedMotion = false) {
    const targetRaise = pose.gesture === "hand_raise" ? 1 : 0;
    if (!initialized || reducedMotion) raise = targetRaise;
    else raise = THREE.MathUtils.damp(raise, targetRaise, 7, Math.min(dt, .05));
    initialized = true;
    if (Math.abs(raise - targetRaise) < .001) raise = targetRaise;
    action.time = raise * clip.duration;
    mixer.update(0);
    head.quaternion.copy(headRest);
    spine.quaternion.copy(spineRest);
    if (!reducedMotion) {
      headDelta.setFromEuler(euler.set(Math.sin(seconds * .79) * .010, Math.sin(seconds * .39) * .022, Math.sin(seconds * .57) * .009));
      head.quaternion.multiply(headDelta);
      spineDelta.setFromEuler(euler.set(Math.sin(seconds * 1.65) * .005, 0, Math.sin(seconds * .48) * .003));
      spine.quaternion.multiply(spineDelta);
    }
    for (const mesh of faces) mesh.morphTargetInfluences!.fill(0);
    const mood = pose.mood || "neutral";
    const smile = mood === "friendly" ? .48 : mood === "confident" ? .34 : mood === "focused" ? .08 : .28;
    const level = THREE.MathUtils.clamp(pose.voiceLevel ?? .65, 0, 1);
    const viseme = level < .015 ? "rest" : pose.viseme || "rest";
    const speaking = viseme !== "rest";
    morph("mouthSmileLeft", smile * (speaking ? .25 : 1));
    morph("mouthSmileRight", smile * (speaking ? .25 : 1));
    morph("cheekSquintLeft", smile * .18); morph("cheekSquintRight", smile * .18);
    morph("browInnerUp", mood === "friendly" ? .06 : 0);
    morph("browDownLeft", mood === "focused" ? .16 : 0);
    morph("browDownRight", mood === "focused" ? .16 : 0);
    morph("browOuterUpRight", mood === "confident" ? .12 : 0);
    if (speaking) morph(VISEMES[viseme], viseme === "mbp" ? .7 : .28 + level * .50);
    const phase = seconds % 4.7;
    const blink = !reducedMotion && phase < .19 ? Math.sin(phase / .19 * Math.PI) : 0;
    morph("eyeBlinkLeft", blink); morph("eyeBlinkRight", blink);
    if (!reducedMotion) {
      const gaze = Math.sin(seconds * .35) * .045;
      morph("eyeLookInLeft", Math.max(0, gaze)); morph("eyeLookOutRight", Math.max(0, gaze));
      morph("eyeLookOutLeft", Math.max(0, -gaze)); morph("eyeLookInRight", Math.max(0, -gaze));
    }
    root.updateMatrixWorld(true);
    hand.getWorldPosition(handPosition);
    return { raise, viseme, mouthOpen: speaking && viseme !== "mbp", blink,
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
