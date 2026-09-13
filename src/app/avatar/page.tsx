import type { Metadata } from "next";
import { AvatarNavigation } from "@/components/AvatarNavigation";

import { AvatarSettingsForm } from "@/components/AvatarSettingsForm";
import { getRequestLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: locale === "it" ? "Avatar" : "Avatar" };
}

export default async function AvatarPage() {
  const locale = await getRequestLocale();
  const isItalian = locale === "it";

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-6">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Avatar</h1>
          <p className="mt-2 text-sm text-slate-600">{isItalian ? "Scegli nome e aspetto, poi prova la voce." : "Choose a name and appearance, then try the voice."}</p>
        </div>
      </div>
      <AvatarNavigation active="settings" locale={locale} />
      <AvatarSettingsForm />
    </div>
  );
}
