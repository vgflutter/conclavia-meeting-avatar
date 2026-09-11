import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Browser tests and lifecycle checks share an isolated database, never the user's meeting history.
process.env.MONGODB_DB_NAME ||= `conclavia_e2e_${randomUUID().replaceAll("-", "")}`;
process.env.MEETING_BOT_PROVIDER = "preview";
process.env.MEETING_AI_ENABLED = "false";
// Never spend voice credits or alter the default voice during regression tests.
process.env.MEETING_TTS_PROVIDER = "inworld";
process.env.INWORLD_API_KEY = "";
process.env.INWORLD_TTS_MODEL = "inworld-tts-2-flash";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command:
      "NEXT_DIST_DIR=.next-e2e MEETING_BOT_PROVIDER=preview MEETING_AI_ENABLED=false ATTENDEE_WEBHOOK_SECRET= npm run dev -- --port 3101",
    url: "http://127.0.0.1:3101/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],
});
