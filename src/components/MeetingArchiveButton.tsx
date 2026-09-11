"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/i18n/I18nProvider";

export function MeetingArchiveButton({ meetingId, archived }: { meetingId: string; archived: boolean }) {
  const { locale } = useTranslations();
  const it = locale === "it";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function archive() {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/meetings/${meetingId}/archive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: !archived }) });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch { setError(it ? "Non disponibile: verifica che il collega sia uscito." : "Unavailable: check that the colleague has left."); }
    finally { setPending(false); }
  }
  return <div className="max-w-64"><button type="button" disabled={pending} onClick={archive} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{pending ? "…" : archived ? it ? "Annulla archiviazione" : "Undo archive" : it ? "Archivia" : "Archive"}</button>{error && <p role="alert" className="mt-1 text-xs font-normal text-red-700">{error}</p>}</div>;
}
