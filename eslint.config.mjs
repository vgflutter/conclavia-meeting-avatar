import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  // The hand proof is bundled from typed source plus the canonical kit.
  globalIgnores([".next*/**", "test-results/**", "playwright-report/**", "out/**", "next-env.d.ts", "public/daily-launch/hand-lab/preview.js"]),
]);
