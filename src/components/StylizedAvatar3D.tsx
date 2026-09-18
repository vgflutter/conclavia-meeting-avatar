"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createRiggedAvatar } from "@/lib/rigged-avatar";
import type { BusinessAvatarProps } from "@/components/BusinessAvatar";
import styles from "./StylizedAvatar3D.module.css";

export default function StylizedAvatar3D({ appearance = "business_clay", mood = "neutral", viseme = "rest", gesture = "rest", voiceLevel,
  ariaLabel = "Avatar 3D", fallback }: BusinessAvatarProps & { fallback: ReactNode }) {
  const mount = useRef<HTMLDivElement>(null);
  const pose = useRef({ mood, viseme, gesture, voiceLevel });
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => { pose.current = { mood, viseme, gesture, voiceLevel }; }, [mood, viseme, gesture, voiceLevel]);

  useEffect(() => {
    const element = mount.current;
    if (!element || failed) return;
    delete element.dataset.rendererReady;
    let disposed = false;
    const abort = new AbortController();
    let rig: ReturnType<typeof createRiggedAvatar> | undefined;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }); }
    catch { queueMicrotask(() => setFailed(true)); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .90;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xfff5e8, 0x606876, .8));
    const key = new THREE.DirectionalLight(0xffefdf, 1.8); key.position.set(-3, 4, 5); scene.add(key);
    key.target.position.set(0, 1.3, 0); scene.add(key.target);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -.9, right: .9, top: .9, bottom: -.9, near: .1, far: 12 });
    key.shadow.bias = -.00015; key.shadow.normalBias = .002;
    const fill = new THREE.DirectionalLight(0xe3eeff, .65); fill.position.set(3, 2, 4); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe2c3, 1.6); rim.position.set(1, 3, -2); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(28, 1, .05, 20);
    camera.position.set(0, 1.46, 2.05); camera.lookAt(0, 1.43, 0);
    function resize() {
      const { width, height } = element!.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.position.z = Math.max(1.65, 1.56 / camera.aspect);
      camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    }
    element.append(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const lost = (event: Event) => { event.preventDefault(); if (!disposed) setFailed(true); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    const name = appearance === "business_clay_female" ? "female" : "male";
    void (async () => {
      try {
        const response = await fetch(`/avatars/rigged-v1/${name}.glb`, { signal: abort.signal });
        if (!response.ok) throw new Error("Avatar model unavailable");
        const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
        const loaded = createRiggedAvatar(gltf);
        if (disposed) { loaded.dispose(); return; }
        rig = loaded; scene.add(rig.root);
        loaded.update(pose.current, 1, 0, motion.matches);
        await renderer.compileAsync(scene, camera);
        if (disposed) return;
        let last = 0; let maxFrameGap = 0;
        renderer.setAnimationLoop((ms: number) => {
          if (document.hidden) { last = 0; return; }
          const dt = last ? (ms - last) / 1000 : 0;
          if (dt > 0) maxFrameGap = Math.max(maxFrameGap, dt * 1000);
          last = ms;
          const state = loaded.update(pose.current, ms / 1000, dt, motion.matches);
          renderer.render(scene, camera);
          element.dataset.renderedViseme = state.viseme;
          element.dataset.mouthOpen = String(state.mouthOpen);
          element.dataset.handRaised = String(state.raise > .98);
          element.dataset.raiseProgress = state.raise.toFixed(4);
          element.dataset.handPosition = state.handPosition.map(v => v.toFixed(5)).join(",");
          element.dataset.boneCount = String(state.boneCount);
          element.dataset.blink = state.blink.toFixed(3);
          element.dataset.maxFrameGapMs = maxFrameGap.toFixed(1);
          element.dataset.rendererReady = "true";
        });
      } catch { if (!disposed) setFailed(true); }
    })();
    return () => {
      disposed = true; abort.abort(); observer.disconnect(); renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      rig?.dispose(); key.shadow.dispose(); environment.dispose(); renderer.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [appearance, failed]);

  return <div className={styles.avatar} data-design="rigged-3d" data-appearance={appearance}
    data-viseme={viseme} data-mood={mood} data-gesture={gesture} data-renderer={failed ? "fallback-2d" : "webgl"}>
    {failed ? <>{fallback}<p className={styles.notice} role="status">3D non disponibile / unavailable · 2D</p></>
      : <div ref={mount} className={styles.canvas} role="img" aria-label={ariaLabel} data-testid="avatar-3d-canvas" />}
  </div>;
}
