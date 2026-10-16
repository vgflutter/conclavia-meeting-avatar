"use client";

import { useEffect, useRef, useState } from "react";
import type { TalkInput } from "@/types/podcast";
import { getStudioCastOptions, type StudioCast } from "@/lib/podcast/studio-themes";
import { PodcastStageView, type PodcastDirection } from "./PodcastStageView";
import { Field, usePodcastCopy } from "./PodcastUi";
import type { PodcastGuestPreflightController } from "./usePodcastGuestPreflight";
import styles from "./Podcast.module.css";
import preflight from "./PodcastGuestPreflight.module.css";

function PrivateCamera({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const video = ref.current; if (!video) return; video.srcObject = stream; void video.play().catch(() => undefined); return () => { video.pause(); video.srcObject = null; }; }, [stream]);
  return <video ref={ref} muted playsInline autoPlay className={preflight.privateVideo} data-testid="podcast-private-camera" />;
}

export function PodcastGuestPreflight({ controller, talk, direction }: {
  controller: PodcastGuestPreflightController;
  talk: Pick<TalkInput, "title" | "topic" | "participants" | "settings">;
  direction: PodcastDirection;
}) {
  const copy = usePodcastCopy();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showRaw, setShowRaw] = useState(false);
  const { open, draft, stream, published, tracking } = controller;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  const status = tracking === "tracking" ? copy("Volto agganciato", "Face tracked") : tracking === "lost" ? copy("Volto non visibile · avatar neutro", "Face not visible · neutral avatar") : tracking === "error" ? copy("Tracking non disponibile · riprova la videocamera", "Tracking unavailable · restart the camera") : copy("Preparazione del modello locale…", "Preparing the local model…");
  const avatarReady = draft.presentation !== "avatar" || tracking === "tracking" || tracking === "lost";
  return <dialog ref={dialogRef} className={preflight.dialog} aria-labelledby="podcast-preflight-title" data-testid="podcast-guest-preflight" onCancel={event => { event.preventDefault(); controller.closePreparation(); }}>
    {open && <div className={preflight.inner}>
      <header className={preflight.header}><div><div className={styles.eyebrow}>{copy("FUORI ONDA", "OFF AIR")}</div><h2 id="podcast-preflight-title">{copy("Prepara l’ospite", "Prepare the guest")}</h2><p>{copy("Scegli come apparire. La scena in onda cambia soltanto quando premi Porta in scena.", "Choose how to appear. The program changes only when you select Bring on air.")}</p></div><button className={styles.secondary} onClick={controller.closePreparation} aria-label={copy("Chiudi preparazione ospite", "Close guest preparation")}>✕</button></header>
      <div className={preflight.grid}>
        <section className={preflight.previewColumn} aria-label={copy("Anteprima fuori onda", "Off-air preview")}>
          <div className={preflight.preview} data-testid="podcast-preflight-preview"><PodcastStageView talk={talk} direction={{ ...direction, focus: "guest", automatic: false }} reserveGuest guestStream={draft.presentation === "video" ? stream : undefined} guestPresentation={draft.presentation} guestAvatar={draft.presentation === "avatar" ? controller.draftAvatar : undefined} /><span className={preflight.badge}>{copy("ANTEPRIMA PRIVATA · FUORI ONDA", "PRIVATE PREVIEW · OFF AIR")}</span></div>
          <p className={preflight.explainer}>{draft.presentation === "avatar" ? copy("La videocamera pilota occhi, sopracciglia, bocca e orientamento del volto. Se perdiamo il viso, resta un avatar neutro.", "Your camera drives eyes, eyebrows, mouth, and head orientation. If your face is lost, the avatar returns to neutral.") : copy("Il video reale viene inserito nello spazio dell’ospite. Questa anteprima resta fuori dalla registrazione del programma.", "Your real video appears in the guest space. This preview stays outside the program recording.")}</p>
          {stream && <><label className={styles.switch}><input type="checkbox" checked={showRaw} onChange={event => setShowRaw(event.target.checked)} />{copy("Mostra la videocamera privata di controllo", "Show the private camera monitor")}</label>{showRaw && <div className={preflight.rawMonitor}><PrivateCamera stream={stream} /><span>{copy("Solo per te · non entra nel programma", "Only for you · excluded from the program")}</span></div>}</>}
        </section>
        <div className={preflight.controls}>
          <fieldset className={preflight.modeGroup}><legend>{copy("Come vuoi apparire?", "How would you like to appear?")}</legend>{([ ["video", copy("Video reale", "Real video"), copy("La tua immagine dalla videocamera", "Your camera image")], ["avatar", copy("Avatar animato", "Animated avatar"), copy("Un personaggio segue le tue espressioni", "A character follows your expressions")] ] as const).map(([value, label, description]) => <label key={value} className={`${preflight.mode} ${draft.presentation === value ? preflight.selected : ""}`}><input type="radio" name="podcast-guest-presentation" value={value} checked={draft.presentation === value} onChange={() => controller.setDraft(current => ({ ...current, presentation: value }))} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</fieldset>
          {draft.presentation === "avatar" && <><Field label={copy("Famiglia del personaggio ospite", "Guest character family")}><select className={styles.input} value={draft.cast} onChange={event => controller.setDraft(current => ({ ...current, cast: event.target.value as StudioCast }))}>{getStudioCastOptions(talk.settings.studioTheme).map(cast => <option key={cast.id} value={cast.id}>{copy(cast.label.it, cast.label.en)}</option>)}</select></Field><Field label={copy("Aspetto del personaggio ospite", "Guest character appearance")}><select className={styles.input} value={draft.appearance} onChange={event => controller.setDraft(current => ({ ...current, appearance: event.target.value as "male" | "female" }))}><option value="male">{copy("Personaggio maschile", "Male character")}</option><option value="female">{copy("Personaggio femminile", "Female character")}</option></select></Field></>}
          <div className={preflight.cameraBox}>{stream ? <><span className={preflight.cameraState}>● {copy("Videocamera accesa · microfono spento", "Camera on · microphone off")}</span><button className={styles.secondary} onClick={controller.stopCamera}>{copy("Spegni videocamera e togli dalla scena", "Stop camera and take off air")}</button></> : <><p>{copy("La videocamera si attiva solo con il pulsante qui sotto.", "The camera starts only through the button below.")}</p><button className={styles.primary} disabled={controller.pending} onClick={() => void controller.startCamera()}>{controller.pending ? copy("Apertura videocamera…", "Opening camera…") : copy("Accendi videocamera per la prova", "Start camera for the test")}</button></>}</div>
          {controller.cameraError && <div className={styles.error} role="alert">{controller.cameraError}</div>}
          {stream && draft.presentation === "avatar" && <div className={preflight.tracking} role="status" data-testid="podcast-tracking-status" data-tracking={tracking}><strong>{status}</strong><span>{controller.fps} fps{controller.latencyMs === undefined ? "" : ` · ${Math.round(controller.latencyMs)} ms`}</span><button className={styles.secondary} disabled={tracking !== "tracking"} onClick={controller.calibrate}>{copy("Centra la posizione della testa", "Center the head position")}</button><small>{draft.calibration ? copy("Posizione centrale acquisita. Puoi continuare a parlare e muoverti.", "Center position captured. Keep speaking and moving.") : copy("Guarda in camera con il viso rilassato, poi centra la testa.", "Look at the camera with a relaxed face, then center your head.")}</small></div>}
          <p className={styles.cameraNotice}>{copy("Elaborazione del volto sul dispositivo. Nessun video o misura del volto viene caricato o salvato. Questa prova non attiva il microfono; collegamento remoto e trascrizione dell’ospite restano da integrare.", "Face processing stays on your device. No video or facial measurements are uploaded or saved. This test does not enable the microphone; remote connection and guest transcription are still to be integrated.")}</p>
        </div>
      </div>
      <footer className={preflight.footer}><span>{published ? copy("L’ospite attuale resta in scena finché non applichi la nuova scelta.", "The current guest stays on air until you apply the new choice.") : copy("L’ospite non è ancora in scena.", "The guest is not on air yet.")}</span><div className={styles.actions}><button className={styles.secondary} onClick={controller.closePreparation}>{copy("Annulla e chiudi", "Cancel and close")}</button><button className={styles.primary} data-testid="podcast-guest-publish" disabled={!stream || !avatarReady} onClick={controller.publish}>{copy("Porta in scena", "Bring on air")} →</button></div></footer>
    </div>}
  </dialog>;
}
