// Build-free e2e runner: serves ./dist with `vite preview`, runs the node:test suites in ./e2e, exits
// with their status. `npm run build` first (CI does). Set E2E_CHROME to a Chromium path to skip
// Playwright's own browser download (the sandbox pre-installs one under /opt/pw-browsers).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("dist/index.html")) { console.error("dist/ missing — run `npm run build` first"); process.exit(2); }
const PORT = process.env.E2E_PORT || "4173";
const server = spawn("npx", ["vite", "preview", "--port", PORT, "--strictPort"], { stdio: ["ignore", "inherit", "inherit"] });
// readiness = the server answers HTTP (vite colours its banner, so don't parse stdout for the port)
const ready = new Promise((res, rej) => {
  let dead = false;
  server.on("exit", c => { dead = true; rej(new Error("preview exited " + c)); });
  const t0 = Date.now();
  const poll = async () => {
    if (dead) return;
    try { const r = await fetch("http://localhost:" + PORT + "/"); if (r.ok) return res(); } catch { /* not up yet */ }
    if (Date.now() - t0 > 30000) return rej(new Error("preview did not start"));
    setTimeout(poll, 250);
  };
  poll();
});
try {
  await ready;
  const t = spawn(process.execPath, ["--test", "--test-concurrency=1", "e2e/mobile.e2e.mjs"], { stdio: "inherit", env: { ...process.env, E2E_BASE: "http://localhost:" + PORT } });
  const code = await new Promise(res => t.on("exit", res));
  process.exitCode = code ?? 1;
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { server.kill(); }
