"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTranslations } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/locale";
import styles from "./Header.module.css";

export function Header() {
  const { locale, setLocale } = useTranslations();
  const pathname = usePathname();
  const hidden = pathname === "/podcast/tg/render" || pathname.startsWith("/meeting-room/") || /^\/podcast\/[^/]+\/broadcast\/?$/u.test(pathname);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--workspace-header-height", `${headerRef.current?.getBoundingClientRect().height ?? 0}px`);
    measure();
    const observer = new ResizeObserver(measure);
    if (headerRef.current) observer.observe(headerRef.current);
    return () => { observer.disconnect(); root.style.removeProperty("--workspace-header-height"); };
  }, [hidden]);
  if (hidden) return null;
  const it = locale === "it";
  const area = pathname.startsWith("/podcast") ? "podcast" : pathname.startsWith("/onboarding") ? "onboarding" : pathname === "/" ? "home" : "meeting";
  const sections = area === "meeting" ? [
    { href: "/meetings", label: it ? "Riunioni" : "Meetings", active: pathname.startsWith("/meetings") },
    { href: "/memory", label: it ? "Memoria" : "Memory", active: pathname.startsWith("/memory") },
    { href: "/context", label: it ? "Contesto" : "Context", active: pathname.startsWith("/context") },
    { href: "/avatar", label: "Avatar", active: pathname.startsWith("/avatar") },
  ] : area === "podcast" ? [
    { href: "/podcast", label: it ? "Puntate" : "Episodes", active: !/^\/podcast\/(?:styles|preview|rehearsal|tg)(?:\/|$)/u.test(pathname) },
    { href: "/podcast/tg", label: "Conclavia TG", active: pathname.startsWith("/podcast/tg") },
    { href: "/podcast/rehearsal", label: it ? "Prova a due" : "Two-host rehearsal", active: pathname.startsWith("/podcast/rehearsal") },
    { href: "/podcast/styles", label: it ? "Stili e mood" : "Styles & moods", active: /^\/podcast\/(?:styles|preview)(?:\/|$)/u.test(pathname) },
  ] : [];
  const createHref = area === "podcast" ? "/podcast/new" : "/meetings/new";
  const createLabel = area === "podcast" ? it ? "Nuovo podcast" : "New podcast" : it ? "Nuovo meeting" : "New meeting";
  return <header ref={headerRef} className={styles.header} data-testid="workspace-header" data-area={area}>
    <div className={styles.topline}>
      <Link href="/" aria-label={it ? "Conclavia · Tutte le aree" : "Conclavia · All areas"} className={styles.brand}>
        <Image src="/brand/logo.svg" alt="Conclavia" width={1800} height={420} priority />
      </Link>
      <div className={styles.tools}>
        <label className="sr-only" htmlFor="interface-language">{it ? "Lingua dell’interfaccia" : "Interface language"}</label>
        <select id="interface-language" value={locale} onChange={event => setLocale(event.target.value as Locale)}><option value="en">EN</option><option value="it">IT</option></select>
        {(area === "meeting" || area === "podcast") && pathname !== createHref && <Link href={createHref} className={styles.create}>{createLabel}<span aria-hidden="true">＋</span></Link>}
      </div>
    </div>
    <nav className={styles.areas} aria-label={it ? "Navigazione principale" : "Primary navigation"}>
      {[
        ["meeting", "/meetings", it ? "Meeting" : "Meetings"],
        ["podcast", "/podcast", it ? "Podcast" : "Podcasts"],
        ["onboarding", "/onboarding", "Onboarding"],
      ].map(([id, href, label]) => <Link key={id} href={href} data-area={id} aria-current={area === id ? "page" : undefined}><span className={styles.areaDot} aria-hidden="true" />{label}</Link>)}
    </nav>
    {sections.length > 0 && <div className={styles.sectionRow}>
      <span className={styles.areaName}>{area === "meeting" ? it ? "AREA MEETING" : "MEETING AREA" : it ? "AREA PODCAST" : "PODCAST AREA"}</span>
      <nav className={styles.sections} aria-label={area === "meeting" ? it ? "Navigazione meeting" : "Meeting navigation" : it ? "Navigazione podcast" : "Podcast navigation"}>
        {sections.map(section => <Link key={section.href} href={section.href} aria-current={section.active ? "page" : undefined}>{section.label}</Link>)}
      </nav>
    </div>}
  </header>;
}
