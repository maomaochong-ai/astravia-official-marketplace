/**
 * Go 后端子进程、端口预留、就绪信号、信号转发
 *
 * 由 server/src/service.ts 按职责切出（ADR-0012）。
 */
import net from "node:net";
import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { DATA_DIR, HOST_PORT } from "./config.ts";
import { PUBLIC_ORIGIN, STABLE_PORT } from "./origin.ts";
import type { AddressInfo } from "node:net";
import { STATE, clearFailure, fail } from "./state.ts";
import { GO_BINARY, NODE_BIN, PI_RUNTIME, PLUGIN_PACKAGES, SERVER_DIR, WEB_DIST } from "./paths.ts";

export let BACKEND_PORT = 0;
export let goProcess = null;
export function corsOrigins() {
  const ports = [...new Set([STABLE_PORT || HOST_PORT, HOST_PORT])];
  return [...new Set(ports.flatMap((port) => [`http://127.0.0.1:${port}`, `http://localhost:${port}`]))].join(",");
}

export function backendEnv() {
  return {
    ...process.env,
    CANVAS_BACKEND_ADDR: `127.0.0.1:${BACKEND_PORT}`,
    CANVAS_BACKEND_DATA_DIR: DATA_DIR,
    // 上游发布 tag 的后端没有静态承载代码，这个变量会被忽略；留着是为了将来载荷换成
    // 带 CANVAS_STATIC_DIR 支持的构建时不用再改这里。静态文件始终由 shim 先服务（ADR-0008）。
    CANVAS_STATIC_DIR: WEB_DIST,
    // 两个 origin 都要放行：稳定 origin 是页面真正的来源，宿主端口留给探针与旧标签页（ADR-0010）。
    CANVAS_CORS_ORIGINS: corsOrigins(),
    CANVAS_EXIT_WITH_PARENT: "true",
    CANVAS_PARENT_PID: String(process.pid),
    GIN_MODE: "release",
    // 公开资源基址：上传到本地存储的文件要拼出一个浏览器能取回的绝对地址，
    // 后端在它为空时直接拒绝（资源接口返回「尚未配置服务器访问地址」）。
    // ADR-0010 之前这里写的是宿主端口，于是落库的图片地址在下次启动就全部失活；
    // 现在用固定 origin，旧资源地址也不会跟着端口漂。
    CANVAS_PUBLIC_BASE_URL: PUBLIC_ORIGIN,
    ...(NODE_BIN ? { CANVAS_NODE_BIN: NODE_BIN } : {}),
    ...(fs.existsSync(PI_RUNTIME) ? { CANVAS_PI_RUNTIME_DIR: PI_RUNTIME } : {}),
    CANVAS_RUNTIME_AUTO_INSTALL: "false",
    // ADR-0006 决策 2：画布渠道要指回本机回环上的模型桥（/bridge/v1），而后端默认把
    // 回环/私网地址当作 SSRF 风险拒掉。只放行回环字面量，不放宽成整段私网。
    CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS: "127.0.0.1,localhost",
    CANVAS_OFFICIAL_PLUGIN_DIR: PLUGIN_PACKAGES,
    CANVAS_REGISTRATION_ENABLED: "false",
  };
}

// 分配一个固定端口交给 Go：它自己在 :0 模式下不回报真实端口。
export async function reserveBackendPort() {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      BACKEND_PORT = (probe.address() as AddressInfo).port;
      probe.close(resolve);
    });
  });
}

// Go 用 log/slog 写 stderr，启动监听地址不会出现在 stdout，两条流都要解析。
export function watchBackendOutput(chunk, sink) {
  const text = chunk.toString();
  sink.write(text);
  if (goPort) return;
  const match = text.match(/addr=(?:127\.0\.0\.1|\[::1\]|localhost):(\d+)/);
  if (!match || Number(match[1]) === 0) return;
  goPort = Number(match[1]);
  console.log(`[open-ai-canvas] Backend listening on port ${goPort}`);
  STATE.phase = "ready";
  clearFailure();
  STATE.message = "运行时已就绪";
  onBackendReady();
}

export function startBackend() {
  console.log(`[open-ai-canvas] Starting backend: ${GO_BINARY}`);
  goProcess = spawn(GO_BINARY, [], {
    env: backendEnv(),
    cwd: SERVER_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  goProcess.stdout.on("data", (chunk) => watchBackendOutput(chunk, process.stdout));
  goProcess.stderr.on("data", (chunk) => watchBackendOutput(chunk, process.stderr));
  goProcess.on("error", (error) => {
    fail("backend-spawn-failed", `后端子进程拉起失败：${error.message}`, "后端启动");
    console.error(`[open-ai-canvas] Failed to spawn backend: ${error.message}`);
  });
  goProcess.on("exit", (code, signal) => {
    console.log(`[open-ai-canvas] Backend exited: code=${code} signal=${signal}`);
    // 主动停止（宿主发了信号）不是故障，直接跟着退，不要把 failed 写进状态。
    if (shuttingDown) {
      process.exit(0);
    }
    // 准备阶段就退出说明后端根本起不来；把原因留给界面，而不是直接杀掉 shim。
    if (!goPort) {
      fail("backend-exited", `后端在启动阶段退出（code=${code} signal=${signal}）`, "后端启动");
      return;
    }
    process.exit(code ?? 1);
  });
}

export let goPort = null;
export let backendReadyResolve = null;
export const backendReady = new Promise((resolve) => {
  backendReadyResolve = resolve;
});

export function onBackendReady() {
  if (backendReadyResolve) backendReadyResolve();
  backendReadyResolve = null;
}

// --- 信号转发 ---
// 收到停止信号必须让 shim 自己退出：准备阶段子进程可能还没 spawn，
// 转发是空操作；已 spawn 的后端也不保证响应。shim 赖着不退，宿主会认为 stop 没生效，
// 反复重试并累积多个僵尸进程——这是「界面反复重试甚至崩溃」的一半成因。
export let shuttingDown = false;

export function forwardSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  // 准备阶段还没有后端子进程，没有需要优雅关闭的东西，立刻退。
  if (!goProcess || goProcess.killed) {
    process.exit(0);
  }
  try {
    goProcess.kill(signal);
  } catch {
    process.exit(0);
  }
  // 给后端 3 s 优雅退出；下载中途退出留下的 .partN 正是续传要用的。
  const force = setTimeout(() => process.exit(0), 3_000);
  force.unref?.();
}
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
process.on("SIGINT", () => forwardSignal("SIGINT"));

// ============================================================
// MCP Server —— 18 个工具，覆盖画布完整操控能力
// 参考 ADR-0002（工具集与鉴权）与 ADR-0007（声明式编排）
// ============================================================

// 节点类型、metadata 字段与布局步长见 ./contract.ts

// 上一次编排的 plan，用于 `__key` 幂等与重放（进程内，不落盘）。
