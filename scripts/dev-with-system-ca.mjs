// Explicit managed-network launcher. Keep TLS verification enabled and use
// only authorities already trusted by the operating system.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import "./system-ca.mjs";

const root = new URL("../", import.meta.url);
const preload = new URL("./system-ca.mjs", import.meta.url).href;
const child = spawn(process.execPath, [
  fileURLToPath(new URL("node_modules/next/dist/bin/next", root)),
  "dev", ...process.argv.slice(2),
], {
  cwd: fileURLToPath(root), stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --import=${preload}`.trim() },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1); });
