"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import portraits from "@/assets/avatar/portraits-2-5d-adult-v3.png";
import layers from "@/assets/avatar/portraits-2-5d-arm-layers-v2.png";
import features from "@/assets/avatar/portraits-2-5d-adult-features-v3.png";
import type { BusinessAvatarProps } from "@/components/BusinessAvatar";
import styles from "./PortraitAvatar.module.css";

/** Texture rig: local facial motion and audio-clock phonemes, not generated video. */
export function PortraitAvatar({ appearance = "business_clay", gesture = "rest", voiceLevel = 0,
  viseme = "rest", mood = "neutral", ariaLabel = "Ritratto del collega digitale", fallback }: BusinessAvatarProps & { fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const mount = useRef<HTMLDivElement>(null);
  const pose = useRef({ gesture, voiceLevel, viseme, mood });
  useLayoutEffect(() => { pose.current = { gesture, voiceLevel, viseme, mood }; }, [gesture, voiceLevel, viseme, mood]);
  useEffect(() => {
    const element = mount.current;
    if (!element || failed) return;
    delete element.dataset.rendererReady;
    let disposed = false;
    let release: (() => void) | undefined;
    const lost = (event: Event) => { event.preventDefault(); setFailed(true); };
    element.addEventListener("webglcontextlost", lost, true);
    // Explicit decode also handles images cached before React hydration.
    const images = [portraits, features, layers].map(source => { const image = new window.Image(); image.src = source.src; return image; });
    void Promise.all([Promise.all(images.map(image => image.decode())), import("@/lib/portrait-renderer")])
      .then(([, module]) => { if (!disposed) release = module.createPortraitRenderer(element, images, appearance === "business_clay_female", () => pose.current); })
      .catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; element.removeEventListener("webglcontextlost", lost, true); release?.(); };
  }, [appearance, failed]);
  const level = Number.isFinite(voiceLevel) ? Math.max(0, Math.min(1, voiceLevel)) : 0;
  return <div className={styles.portrait} data-design="portrait-2-5d" data-appearance={appearance}
    data-gesture={gesture} data-viseme={viseme} data-mood={mood} data-lipsync="audio-visemes" data-speaking={level > .025}
    data-renderer={failed ? "fallback-2d" : "texture-rig"} data-asset={portraits.src} data-features-asset={features.src} data-layers-asset={layers.src}
    data-testid="avatar-portrait">
    {failed ? <>{fallback}<p className={styles.notice} role="status">2.5D non disponibile / unavailable · 2D</p></> : <>
      <div ref={mount} className={styles.picture} role="img" aria-label={`${ariaLabel} · 2.5D`} data-testid="portrait-canvas" />
      <p className={styles.loading} role="status">Caricamento / Loading…</p>
      <div className={styles.audio} role="meter" aria-label="Livello audio / Audio level"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}
        aria-hidden={level <= .025} style={{ "--audio-level": level } as CSSProperties}>
        {[.45, .8, 1, .7, .4].map((weight, i) => <span key={i}
          style={{ "--weight": weight } as CSSProperties} />)}
      </div>
    </>}
  </div>;
}
