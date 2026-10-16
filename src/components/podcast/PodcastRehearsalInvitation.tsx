"use client";

import Link from "next/link";
import { usePodcastCopy } from "./PodcastUi";
import styles from "./Podcast.module.css";
import rehearsal from "./PodcastRehearsal.module.css";

export function PodcastRehearsalInvitation({ selectionQuery }: { selectionQuery?: string } = {}) {
  const copy = usePodcastCopy();
  return <aside className={rehearsal.invitation}>
    <div className={rehearsal.invitationInner}>
      <div><strong>{copy("Prima proviamo i due conduttori.", "Let’s try the two hosts first.")}</strong><p>{copy("Una prova con audio e tempi di conversazione, prima di aggiungere l’ospite.", "A rehearsal with audio and conversational timing, before adding a guest.")}</p></div>
      <Link className={styles.secondary} href={selectionQuery ? `/podcast/rehearsal?${selectionQuery}` : "/podcast/rehearsal"}>{copy("Prova a due voci", "Two-voice rehearsal")} →</Link>
    </div>
  </aside>;
}
