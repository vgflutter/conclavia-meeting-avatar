import Link from "next/link";
import type { Locale } from "@/i18n/locale";

export function AvatarNavigation({ active, locale }: { active: "settings" | "test"; locale: Locale }) {
  return (
    <nav aria-label={locale === "it" ? "Configurazione avatar" : "Avatar configuration"} className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {([
        ["settings", "/avatar", locale === "it" ? "Identità e comportamento" : "Identity & behaviour"],
        ["test", "/avatar/test", locale === "it" ? "Prova avatar · voce e movimenti" : "Test avatar · voice & movement"],
      ] as const).map(([id, href, label]) => (
        <Link key={id} href={href} aria-current={active === id ? "page" : undefined}
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${active === id ? "bg-[#295c43] text-white" : "text-slate-600 hover:bg-white"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
