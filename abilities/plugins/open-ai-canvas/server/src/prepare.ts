/**
 * 准备流程编排（幂等、失败留状态）
 *
 * 由 server/src/service.ts 按职责切出（ADR-0012）。
 */
import path from "node:path";
import { BINARY_NAME } from "./config.ts";
import { STATE, clearFailure, fail } from "./state.ts";
import { codedError } from "./sources.ts";
import { resolveAgentDir, resolveNodeBin, resolveRuntimeDir } from "./payload.ts";
import { setRuntimePaths } from "./paths.ts";
import { reserveBackendPort, startBackend } from "./backend.ts";
import { hasWebBundle } from "./web.ts";

export let preparing = false;

// 监听之后才走到这里：解析（或下载）运行时 → 分配端口 → 拉起后端。
// 失败不再 process.exit，而是把原因留在 STATE 里让界面显示并允许手动重试。
export async function prepareRuntime() {
  if (preparing || STATE.phase === "ready") return;
  preparing = true;
  try {
    STATE.phase = "starting";
    STATE.message = "正在检查运行时";
    clearFailure();
    const serverDir = await resolveRuntimeDir();
    setRuntimePaths({
      serverDir,
      goBinary: path.join(serverDir, BINARY_NAME),
      webDist: path.join(serverDir, "web-dist"),
    });
    // 载荷里的前端产物由 shim 自己发（ADR-0008）。缺失时立刻带 code 失败：
    // 否则后端照常就绪、健康门照常通过，用户只会看到一个 404 JSON。
    if (!hasWebBundle()) {
      throw codedError("web-bundle-missing", `载荷里没有前端产物 ${path.join(serverDir, "web-dist", "index.html")}`);
    }
    setRuntimePaths({
      piRuntime: path.join(serverDir, "pi-runtime"),
      pluginPackages: path.join(serverDir, "plugin-packages"),
    });

    // 创作 Agent 与它要用的 node 是独立载荷。上游把 pi 打包给后端自行解包；我们多做一步，
    // 把 node 也一并发，因为宿主进程的 node 可能不满足 pi 的 22.19.0 下限。
    const agentDir = await resolveAgentDir();
    if (agentDir) {
      setRuntimePaths({ piRuntime: path.join(agentDir, "pi-runtime"), nodeBin: resolveNodeBin(agentDir) });
    }

    STATE.phase = "starting-backend";
    STATE.message = "正在启动后端";
    await reserveBackendPort();
    startBackend();
  } catch (error) {
    // code 是契约：解析/下载/解包/守卫各自带过来，缺失时退到 prepare-failed。
    fail(error?.code ?? "prepare-failed", error?.message ?? String(error), "运行时准备");
    console.error(`[open-ai-canvas] 运行时准备失败（${STATE.code}）：${STATE.error}`);
  } finally {
    preparing = false;
  }
}
