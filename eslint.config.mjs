import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  // Generated runtime state, rehearsal artifacts and the hand proof are not source.
  globalIgnores([".next*/**", ".daily-agent/**", ".tg-artifacts/**", "test-results/**", "playwright-report/**", "out/**", "next-env.d.ts", "public/daily-launch/hand-lab/preview.js", "public/daily-launch/acting-render/render.js"]),
]);
