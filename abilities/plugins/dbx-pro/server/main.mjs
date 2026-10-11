#!/usr/bin/env node
/**
 * dbx-pro Node 薄壳 — 宿主 spawn 本文件（kind: host-node），本文件再 spawn python3 server/main.py。
 *
 * 为什么存在：宿主 manifest schema 只认识 host-node / managed-binary，不认识 host-python。
 * 这层薄壳让宿主感知不到 Python 的存在；所有业务逻辑都在 server/main.py。
 *
 * 转发：process.argv（--port / --data / --auth-disabled 等）、环境变量、stdin/stdout。
 */

import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pyScript = join(__dirname, "main.py");

// 优先用宿主 managed Python（如果宿主注入了路径），否则用系统 python3
const pythonBin = process.env.ASTRAVIA_MANAGED_PYTHON_BIN || "python3";

const child = spawn(pythonBin, [pyScript, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(128);
  }
  process.exit(code ?? 0);
});

// 把宿主的 SIGTERM/SIGINT 转发给 Python 子进程
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    try { child.kill(sig); } catch {}
  });
}
