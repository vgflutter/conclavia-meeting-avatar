export function WorkspaceAreaIllustration({ area }: { area: string }) {
  return <svg viewBox="0 0 260 120" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {area === "meeting" ? <>
      <rect x="36" y="22" width="188" height="77" rx="12" opacity=".3" />
      <circle cx="79" cy="48" r="9" /><path d="M61 82v-8c0-21 36-21 36 0v8" />
      <circle cx="130" cy="44" r="11" /><path d="M109 82v-9c0-25 42-25 42 0v9" />
      <circle cx="181" cy="48" r="9" /><path d="M163 82v-8c0-21 36-21 36 0v8M54 84h152" />
    </> : area === "podcast" ? <>
      <rect x="60" y="24" width="28" height="45" rx="14" /><path d="M52 54v7a22 22 0 0 0 44 0v-7M74 83v14M60 98h28M68 35h12M68 42h12M68 49h12" />
      <rect x="172" y="24" width="28" height="45" rx="14" /><path d="M164 54v7a22 22 0 0 0 44 0v-7M186 83v14M172 98h28M180 35h12M180 42h12M180 49h12" />
      <path d="M113 52v12M121 43v30M130 34v48M139 43v30M147 52v12" opacity=".55" />
    </> : <>
      <path d="M66 60h35m58 0h35" opacity=".5" />
      <circle cx="49" cy="60" r="21" /><circle cx="130" cy="60" r="21" /><circle cx="211" cy="60" r="21" />
      <path d="m40 60 6 6 12-13M125 51h9v18h-9M201 60l7 7 13-15" />
      <path d="M38 98h22M119 98h22M200 98h22" opacity=".3" />
    </>}
  </svg>;
}
