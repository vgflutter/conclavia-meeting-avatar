"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/i18n/I18nProvider";

export function MeetingFloorControl({ meetingId, interventionId }: { meetingId: string; interventionId: string }) {
  const { locale } = useTranslations();
  const isItalian = locale === "it";
  const router = useRouter();
  const busy = useRef(false);
  const [state, setState] = useState<"ready" | "sending" | "done" | "error">("ready");
  async function grant() {
    if (busy.current) return;
    busy.current = true;
    setState("sending");
    try {
      const response = await fetch(`/api/meetings/${meetingId}/turn`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interventionId }),
      });
      if (!response.ok && response.status !== 409) throw new Error();
      setState("done");
      router.refresh();
    } catch {
      setState("error");
      busy.current = false;
    }
  }
  if (state === "done") return null;
  return <div>
    <button type="button" onClick={grant} disabled={state === "sending"} className="mt-3 rounded-lg bg-[#bde88d] px-4 py-2 text-sm font-semibold text-[#142516] disabled:opacity-50">
      {state === "sending" ? "…" : isItalian ? "Dai la parola" : "Give the floor"}
    </button>
    {state === "error" && <p role="alert" className="mt-2 text-sm text-red-800">{isItalian ? "Non è stato possibile concedere il turno. Riprova." : "Could not grant the turn. Please retry."}</p>}
  </div>;
}
