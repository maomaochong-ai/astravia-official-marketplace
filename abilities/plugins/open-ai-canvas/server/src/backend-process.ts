/**
 * Go 后端子进程、端口预留、就绪信号、信号转发
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
import net from "node:net";
import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { DATA_DIR, HOST_PORT } from "./service-config.ts";
import { PUBLIC_ORIGIN, STABLE_PORT } from "./stable-origin-binding.ts";
import type { AddressInfo } from "node:net";
import { STATE, clearFailure, fail } from "./preparation-state.ts";
import { GO_BINARY, NODE_BIN, PI_RUNTIME, PLUGIN_PACKAGES, SERVER_DIR, WEB_DIST } from "./runtime-paths.ts";

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
  flushBackendPortWaiters(true);
}

/**
 * 重启期间的特殊语义（ADR-0017）。
 *
 * 升级载荷后要换一个后端进程，但「子进程退了」在原有语义里等于「后端崩了」：
 * 未就绪就退会写 failed，已就绪就退会带走 shim。两条都不成立，所以用一个标志把 exit 区分开。
 */
export let restarting = false;

/** 等后端报出监听端口。与准备阶段那个一次性 promise 分开：重启要的是新鲜的一次等待。 */
const backendPortWaiters = new Set<(ready: boolean) => void>();

function flushBackendPortWaiters(ready) {
  for (const waiter of [...backendPortWaiters]) waiter(ready);
  backendPortWaiters.clear();
}

export function waitForBackendPort(timeoutMs: number): Promise<boolean> {
  if (goPort) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      backendPortWaiters.delete(finish);
      resolve(ready);
    };
    timer = setTimeout(() => finish(Boolean(goPort)), timeoutMs);
    timer.unref?.();
    backendPortWaiters.add(finish);
  });
}

/** 停掉当前后端并等它真退。端口同时清掉：留着旧值会让新进程的就绪日志被忽略。 */
export function stopBackend(timeoutMs = 5_000) {
  const child = goProcess;
  goProcess = null;
  goPort = null;
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // 进程已经没了，强杀失败也算停完。
      }
      finish();
    }, timeoutMs);
    child.once("exit", finish);
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
    }
  });
}

/** 用当前 runtime-paths 拉起一个新后端（载荷升级后调用）。 */
export async function restartBackend() {
  restarting = true;
  try {
    await stopBackend();
    clearFailure();
    STATE.phase = "starting-backend";
    STATE.message = "正在启动新运行时";
    await reserveBackendPort();
    startBackend();
  } catch (error) {
    fail("backend-spawn-failed", `后端重启失败：${error?.message ?? String(error)}`, "后端重启");
    throw error;
  } finally {
    restarting = false;
  }
}

// 起一个后端子进程。spawn 与 watchBackendOutput 的失败语义见下面的 exit 分支。
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
    // 升级重启：这次退出是我们要的，既不算故障，也不能带走 shim。
    if (restarting) return;
    // 主动停止（宿主发了信号）不是故障，直接跟着退，不要把 failed 写进状态。
    if (shuttingDown) {
      process.exit(0);
    }
    // 准备阶段就退出说明后端根本起不来；把原因留给界面，而不是直接杀掉 shim。
    if (!goPort) {
      fail("backend-exited", `后端在启动阶段退出（code=${code} signal=${signal}）`, "后端启动");
      flushBackendPortWaiters(false);
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
// MCP Server —— 28 个工具，覆盖画布完整操控能力（含 8 个内置技能库工具，ADR-0016）
// 参考 ADR-0002（工具集与鉴权）与 ADR-0007（声明式编排）
// ============================================================

// 节点类型、metadata 字段与布局步长见 ./contract.ts

// 上一次编排的 plan，用于 `__key` 幂等与重放（进程内，不落盘）。
