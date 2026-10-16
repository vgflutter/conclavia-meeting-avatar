"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startPodcastFaceTracking } from "@conclavia/avatar-kit/lib/podcast-face-tracker";
import { trackedFaceToPose } from "@conclavia/avatar-kit/lib/podcast-tracked-pose";
import type { PodcastGuest, PodcastTrackedFace } from "@conclavia/avatar-kit/types/podcast";
import type { StudioCast } from "@/lib/podcast/studio-themes";

export interface GuestVisualChoice {
  presentation: "video" | "avatar";
  appearance: "male" | "female";
  cast: StudioCast;
  calibration?: { yaw: number; pitch: number; roll: number };
}
const INITIAL_CHOICE: GuestVisualChoice = { presentation: "video", appearance: "male", cast: "contemporary" };

/** Runtime-only private preparation. No video or face measurements are persisted or broadcast. */
export function usePodcastGuestPreflight() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GuestVisualChoice>(INITIAL_CHOICE);
  const [published, setPublished] = useState<GuestVisualChoice | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pending, setPending] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [trackingStatus, setTrackingStatus] = useState<"loading" | "ready" | "error">("loading");
  const [face, setFace] = useState<PodcastTrackedFace>();
  const [clock, setClock] = useState(0);
  const [fps, setFps] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const samplesRef = useRef<number[]>([]);
  const trackingNeeded = Boolean(stream && ((open && draft.presentation === "avatar") || published?.presentation === "avatar"));

  const releaseCamera = useCallback(() => {
    generationRef.current++;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);
  const stopCamera = useCallback(() => {
    releaseCamera();
    setStream(null); setPublished(null); setFace(undefined); setPending(false); setFps(0);
  }, [releaseCamera]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; releaseCamera(); };
  }, [releaseCamera]);
  useEffect(() => {
    if (!stream) return;
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.autoplay = true;
    videoRef.current = video; video.srcObject = stream;
    void video.play().catch(() => undefined);
    return () => { video.pause(); video.srcObject = null; if (videoRef.current === video) videoRef.current = null; };
  }, [stream]);
  useEffect(() => {
    if (!stream) return;
    const ended = () => { if (streamRef.current === stream) stopCamera(); };
    stream.getTracks().forEach(track => track.addEventListener("ended", ended));
    return () => stream.getTracks().forEach(track => track.removeEventListener("ended", ended));
  }, [stream, stopCamera]);
  useEffect(() => {
    if (!trackingNeeded || !videoRef.current) return;
    const abort = new AbortController();
    samplesRef.current = [];
    const tracker = startPodcastFaceTracking(videoRef.current, {
      signal: abort.signal,
      onStatus: status => { if (!abort.signal.aborted) setTrackingStatus(status); },
      onFrame: frame => {
        if (abort.signal.aborted) return;
        const now = performance.now();
        samplesRef.current = [...samplesRef.current.filter(t => now - t < 1000), now];
        setFps(samplesRef.current.length); setFace(frame); setClock(now);
      },
    });
    const timer = window.setInterval(() => setClock(performance.now()), 50);
    return () => { abort.abort(); tracker.stop(); window.clearInterval(timer); };
  }, [trackingNeeded]);

  async function startCamera() {
    if (streamRef.current || pending) return;
    const generation = ++generationRef.current;
    setPending(true); setCameraError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires HTTPS or localhost.");
      const acquired = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
      if (!mountedRef.current || generationRef.current !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = acquired; setStream(acquired);
    } catch (cause) {
      if (mountedRef.current && generationRef.current === generation) setCameraError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (mountedRef.current && generationRef.current === generation) setPending(false); }
  }
  const tracking: NonNullable<PodcastGuest["avatar"]>["tracking"] = trackingStatus === "error" ? "error" : trackingStatus === "loading" || !face ? "loading" : face.detected && clock - face.capturedAt < 500 ? "tracking" : "lost";
  const neutralFrame = useMemo<PodcastTrackedFace>(() => ({ detected: false, capturedAt: 0, blendshapes: {}, head: { yaw: 0, pitch: 0, roll: 0 } }), []);
  const currentFace = trackingStatus === "error" ? neutralFrame : face ?? neutralFrame;
  const draftAvatar = useMemo<NonNullable<PodcastGuest["avatar"]>>(() => ({ appearance: draft.appearance, cast: draft.cast, pose: trackedFaceToPose(currentFace, clock, draft.calibration), capturedAt: currentFace.capturedAt, tracking }), [draft, currentFace, clock, tracking]);
  const publishedAvatar = useMemo<PodcastGuest["avatar"]>(() => published?.presentation === "avatar" ? { appearance: published.appearance, cast: published.cast, pose: trackedFaceToPose(currentFace, clock, published.calibration), capturedAt: currentFace.capturedAt, tracking } : undefined, [published, currentFace, clock, tracking]);

  function openPreparation() { setDraft(published ? { ...published } : { ...INITIAL_CHOICE }); setOpen(true); setCameraError(""); }
  function closePreparation() { setOpen(false); if (!published) stopCamera(); }
  function publish() { if (!stream) return; setPublished({ ...draft }); setOpen(false); }
  function calibrate() { if (face?.detected && tracking === "tracking") setDraft(current => ({ ...current, calibration: { ...face.head } })); }
  return { open, openPreparation, closePreparation, draft, setDraft, published, stream, pending, cameraError, startCamera, stopCamera,
    videoRef, tracking, draftAvatar, publishedAvatar, fps, latencyMs: face?.latencyMs, calibrate, publish,
    publishedStream: published?.presentation === "video" ? stream : undefined };
}
export type PodcastGuestPreflightController = ReturnType<typeof usePodcastGuestPreflight>;
