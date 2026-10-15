"use client";

import Link from "next/link";
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { useTranslations } from "@/i18n/I18nProvider";
import styles from "./Podcast.module.css";

export function usePodcastCopy() {
  const { locale } = useTranslations();
  return (italian: string, english: string) => locale === "it" ? italian : english;
}

export function PodcastTabs({ id, active }: { id: string; active: "settings" | "studio" }) {
  const copy = usePodcastCopy();
  return <nav className={styles.tabs} aria-label={copy("Sezioni podcast", "Podcast sections")}>
    <Link className={`${styles.tab} ${active === "settings" ? styles.activeTab : ""}`} href={`/podcast/${id}`} aria-current={active === "settings" ? "page" : undefined}>{copy("Puntata e personalità", "Episode & personalities")}</Link>
    <Link className={`${styles.tab} ${active === "studio" ? styles.activeTab : ""}`} href={`/podcast/${id}/studio`} aria-current={active === "studio" ? "page" : undefined}>{copy("Studio e regia", "Studio & direction")}</Link>
  </nav>;
}

export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  const generatedId = useId();
  const control = isValidElement(children) ? children as ReactElement<{ id?: string; "aria-describedby"?: string }> : null;
  const id = control?.props.id || generatedId;
  const helpId = `${id}-help`;
  const description = [control?.props["aria-describedby"], help ? helpId : undefined].filter(Boolean).join(" ") || undefined;
  return <div className={styles.field}><label htmlFor={id}>{label}</label>{control ? cloneElement(control, { id, "aria-describedby": description }) : children}{help && <small id={helpId}>{help}</small>}</div>;
}

export async function podcastRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Request failed (${response.status})`);
  return data as T;
}

export function readableError(error: unknown) { return error instanceof Error ? error.message : "Impossibile completare la richiesta / Unable to complete the request"; }
