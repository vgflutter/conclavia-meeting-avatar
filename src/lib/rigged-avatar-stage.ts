import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Shared production lighting/camera, also used by the direct visual-review harness. */
export function createRiggedAvatarStage(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .55;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffeee0, 0x594640, .3));
  const key = new THREE.DirectionalLight(0xfff3e4, 2.2); key.position.set(-4, 3.5, 3); scene.add(key);
  key.target.position.set(0, 1.3, 0); scene.add(key.target);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -.9, right: .9, top: .9, bottom: -.9, near: .1, far: 12 });
  key.shadow.bias = -.00015; key.shadow.normalBias = .001;
  const fill = new THREE.DirectionalLight(0xe2edff, .5); fill.position.set(3, 2, 4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffeedf, .55); rim.position.set(1, 3, -2); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, 1, .05, 20);
  camera.position.set(0, 1.46, 2.05); camera.lookAt(0, 1.43, 0);
  return { scene, camera,
    resize(width: number, height: number) {
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.position.z = Math.max(1.72, 1.60 / camera.aspect);
      camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    },
    dispose() { key.shadow.dispose(); environment.dispose(); },
  };
}
