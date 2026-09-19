"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { advanceEditorialMouth, advanceEditorialSpring, editorialMouthPaths, editorialMouthTarget, editorialPresence, editorialPalmPath, editorialArmPose, editorialFacePath } from "@/lib/editorial-motion";
import type { BusinessAvatarProps } from "./BusinessAvatar";

export function useEditorialMotion(props: BusinessAvatarProps) {
  const root = useRef<SVGSVGElement>(null);
  const pose = useRef(props);
  const mouth = useRef(editorialMouthTarget("rest", 0));
  const drawMouth = () => {
    const node = root.current;
    if (!node) return;
    const paths = editorialMouthPaths(mouth.current);
    const face = editorialFacePath(pose.current.appearance === "business_clay_female", mouth.current.open * 2.8);
    node.querySelector('[data-rig="face-outline"]')?.setAttribute("d", face);
    node.querySelector('[data-avatar-face-clip] path')?.setAttribute("d", face);
    node.querySelector('[data-mouth-part="clip"]')?.setAttribute("d", paths.cavity);
    for (const [name, path] of Object.entries(paths)) node.querySelector(`[data-mouth-part="${name}"]`)?.setAttribute("d", path);
    node.querySelector('[data-mouth-part="cavity"]')?.setAttribute("opacity", mouth.current.open > .005 ? "1" : "0");
    node.querySelector('[data-mouth-part="teeth"]')?.setAttribute("opacity", String(Math.min(1, mouth.current.open * 3) * (1 - mouth.current.round * .92)));
    node.querySelector('[data-mouth-part="tongue"]')?.setAttribute("opacity", String(Math.max(0, (mouth.current.open - .35) * .6) * (1 - mouth.current.round * .7)));
    node.querySelector('[data-rig="chin"]')?.setAttribute("transform", `translate(0 ${mouth.current.open * 2.2})`);
    node.dataset.renderedMouthOpen = mouth.current.open.toFixed(4);
  };
  useLayoutEffect(() => {
    pose.current = props;
    if (editorialMouthTarget(props.viseme ?? "rest", props.voiceLevel).open === 0) {
      mouth.current.open = 0;
      drawMouth();
    }
  });
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const part = (name: string) => node.querySelector(`[data-rig="${name}"]`);
    const body = part("body"), head = part("head"), hair = part("hair"), eyes = part("eyes"), pupils = part("pupils"), forearm = part("forearm"), forearmOutline = part("forearm-outline"), collar = part("collar"), wrist = part("wrist"), upperArm = part("upper-arm"), palm = part("palm"), handDetail = part("hand-detail");
    let hand = { value: pose.current.gesture === "hand_raise" ? 1 : 0, velocity: 0 };
    let shoulder = { ...hand }, speech = { value: 0, velocity: 0 };
    let previous = 0, elapsed = 0, request = 0;
    const tick = (now: number) => {
      request = requestAnimationFrame(tick);
      if (document.hidden) { previous = 0; return; }
      const dt = previous ? Math.min(.1, (now - previous) / 1000) : 1 / 60;
      previous = now; elapsed += dt;
      const { viseme = "rest", voiceLevel, gesture } = pose.current;
      const target = editorialMouthTarget(viseme, voiceLevel);
      mouth.current = advanceEditorialMouth(mouth.current, target, dt);
      drawMouth();
      hand = advanceEditorialSpring(hand, gesture === "hand_raise" ? 1 : 0, dt, media.matches);
      shoulder = advanceEditorialSpring(shoulder, gesture === "hand_raise" ? 1 : 0, dt, media.matches, 13);
      speech = advanceEditorialSpring(speech, target.open > 0 ? 1 : 0, dt, media.matches, 7);
      const frame = editorialPresence(elapsed, speech.value, shoulder.value, media.matches);
      body?.setAttribute("transform", "translate(0 0)");
      const headTransform = `translate(${frame.head * 1.5} ${frame.nod * .8}) rotate(${frame.nod * .4} 341 405)`;
      head?.setAttribute("transform", headTransform); hair?.setAttribute("transform", headTransform);
      collar?.setAttribute("transform", `translate(341 490) scale(${1 + frame.breath} 1) translate(-341 -490)`);
      eyes?.setAttribute("transform", `translate(0 ${254 * (1 - frame.blink)}) scale(1 ${frame.blink})`);
      pupils?.setAttribute("transform", `translate(${frame.gaze} ${frame.nod * .6})`);
      const raise = hand.value;
      const armPose = editorialArmPose(raise, frame.settle);
      upperArm?.setAttribute("d", armPose.upper);
      forearm?.setAttribute("d", armPose.forearm);
      forearmOutline?.setAttribute("d", armPose.outline);
      wrist?.setAttribute("transform", `translate(${armPose.wrist.x - 612} ${armPose.wrist.y - 432}) rotate(${armPose.angle} 612 432)`);
      palm?.setAttribute("d", editorialPalmPath(raise));
      handDetail?.setAttribute("opacity", String(raise));
      node.dataset.handProgress = raise.toFixed(4);
      node.dataset.bodyLean = frame.body.toFixed(4);
      node.dataset.headTilt = (frame.nod * .4).toFixed(4);
      node.dataset.headOrientation = frame.head.toFixed(4);
      node.dataset.reducedMotion = String(media.matches);
      node.dataset.animationReady = "true";
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, []);
  return root;
}
