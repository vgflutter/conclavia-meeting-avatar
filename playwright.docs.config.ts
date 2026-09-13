import { randomUUID } from "node:crypto";
import { defineConfig } from "@playwright/test";
import regression from "./playwright.config";

// Preserve this exact isolated database in the server and worker subprocesses.
if (!process.env.MONGODB_DB_NAME?.startsWith("conclavia_e2e_docs_")) {
  process.env.MONGODB_DB_NAME = `conclavia_e2e_docs_${randomUUID().replaceAll("-", "")}`;
}

export default defineConfig(regression, {
  testDir: "./tests/docs",
  timeout: 120_000,
  use: { ...regression.use, viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", timezoneId: "Europe/Rome" },
});
