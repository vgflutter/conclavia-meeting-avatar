export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startMeetingEntryMonitor } = await import("./lib/meeting-entry-monitor");
    startMeetingEntryMonitor();
  }
}
