"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createRiggedAvatarStage } from "@/lib/rigged-avatar-stage";
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
    const stage = createRiggedAvatarStage(renderer);
    const { scene, camera } = stage;
    function resize() {
      const { width, height } = element!.getBoundingClientRect();
      stage.resize(width, height);
    }
    element.append(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const lost = (event: Event) => { event.preventDefault(); if (!disposed) setFailed(true); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    let last = 0;
    let animationSeconds = 1;
    const visibility = () => { last = 0; };
    document.addEventListener("visibilitychange", visibility);
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
        let maxFrameGap = 0;
        renderer.setAnimationLoop((ms: number) => {
          if (document.hidden) { last = 0; return; }
          const dt = last ? (ms - last) / 1000 : 0;
          if (dt > 0) maxFrameGap = Math.max(maxFrameGap, dt * 1000);
          last = ms;
          const step = Math.min(.1, Math.max(0, dt));
          animationSeconds += step;
          const state = loaded.update(pose.current, animationSeconds, step, motion.matches);
          renderer.render(scene, camera);
          element.dataset.renderedViseme = state.viseme;
          element.dataset.mouthOpen = String(state.mouthOpen);
          element.dataset.mouthAmplitude = state.mouthAmplitude.toFixed(5);
          element.dataset.shoulderProgress = state.shoulder.toFixed(5);
          element.dataset.torsoProgress = state.torso.toFixed(5);
          element.dataset.headRotation = state.headRotation.map(v => v.toFixed(5)).join(",");
          element.dataset.idleAttention = state.idleAttention.toFixed(5);
          element.dataset.idleAction = state.idleAction;
          element.dataset.torsoRotation = state.torsoRotation.map(v => v.toFixed(7)).join(",");
          element.dataset.lowerSpineRotation = state.lowerSpineRotation.map(v => v.toFixed(7)).join(",");
          element.dataset.chestExpansion = state.chestExpansion.toFixed(6);
          element.dataset.shoulderSettle = state.shoulderSettle.toFixed(5);
          element.dataset.reducedMotion = String(motion.matches);
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
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      rig?.dispose(); stage.dispose(); renderer.dispose();
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
