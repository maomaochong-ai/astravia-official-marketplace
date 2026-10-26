/**
 * 本机运维路由：状态快照、准备页、载荷残留清理
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
import fs from "node:fs";
import path from "node:path";
import { MANIFEST } from "./service-config.ts";
import { STATE, clearFailure, note, progressSnapshot } from "./preparation-state.ts";
import { progressPage } from "./preparation-progress-page.ts";
import { statSize } from "./http-transport.ts";
import { prepareRuntime } from "./preparation-orchestrator.ts";
import { SESSION_KEY, SESSION_TOKEN } from "./canvas-session-store.ts";
import { goPort } from "./backend-process.ts";
import { LAST_WORKFLOW } from "./workflow-compiler.ts";
import { MCP_WAIT_MS, handleMcpRequest, waitForBackend } from "./mcp-protocol-server.ts";
import { MCP_TOOLS, MCP_TOOL_GROUPS } from "./mcp-tool-catalog.ts";
import { AGENT_DIR, PROVISION_DIR } from "./payload-source-resolution.ts";
import { BRIDGE, bridgeExecutorOnline } from "./host-model-bridge.ts";

export function sendJson(res, body, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

/**
 * 清掉下载残留（ADR-0011）。
 *
 * 失败的分片下载会把整个 `.partial.zip` 与 `.partN` 留在 data/runtime 里，为下一次
 * 续传保留基线——这是对的，但它也是上百 MB 的隐形占用，而且没有任何界面能看出
 * “重试”到底会从哪一块接。只删缓存文件，不碰已安装的运行时目录。
 */
export function handlePayloadReset(res) {
  const removed = [];
  let freedBytes = 0;
  const roots = [PROVISION_DIR, AGENT_DIR].filter((dir) => typeof dir === "string" && dir.length > 0);
  for (const dir of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      // 只命中下载中间产物：.partial.zip、.partial.zip.partN、.zip.tmp
      if (!entry.isFile() || !/\.(partial\.zip|zip\.tmp)(\.part\d+)?$/.test(entry.name)) continue;
      const target = path.join(dir, entry.name);
      try {
        freedBytes += statSize(target);
        fs.rmSync(target, { force: true });
        removed.push(entry.name);
      } catch {
        // 删不掉的忽略：下一次下载仍会尝试覆盖
      }
    }
  }
  if (removed.length > 0) {
    STATE.receivedBytes = 0;
    STATE.totalBytes = 0;
    STATE.chunks = [];
    note(`已清理下载残留 ${removed.length} 个文件（${(freedBytes / 1048576).toFixed(1)} MB）`);
  }
  sendJson(res, {
    ok: true,
    removed,
    freedBytes,
    message: removed.length > 0 ? `已清理 ${(freedBytes / 1048576).toFixed(1)} MB 下载残留` : "没有需要清理的分片",
  });
}

// /__canvas/state 是插件侧真正的就绪判据：ready 只在后端子进程已报告监听地址时为真。
// 宿主看到的 /api/health/ready 恒 200（ADR-0003 决策 5），不能用来判断画布能不能用。
// origin 由调用方传入：它属于 origin.ts 的绑定结果，routes 只负责展示，不引反向依赖。
export function stateSnapshot(runtime: { origin?: string | null; originPinned?: boolean } = {}) {
  return {
    ...progressSnapshot(),
    ready: Boolean(goPort) && STATE.phase === "ready",
    backend: Boolean(goPort),
    // 插件视图用它显示「桥在线 / 离线」，没这个字段就只能猜。
    bridge: { executorOnline: bridgeExecutorOnline(), models: BRIDGE.models.length },
    workflow: LAST_WORKFLOW,
    // 地址栏该用的 origin（ADR-0010）。插件据此打开画布，两个端口不一致时才不用依赖 302。
    origin: runtime.origin ?? null,
    originPinned: Boolean(runtime.originPinned),
    // ADR-0001 兼容节：画布上游版本。载荷里没有 VERSION 文件，发布清单里倒是一直带着
    // upstream.tag/commit，所以说真话的成本为零（MANIFEST 在 resolveRuntimeDir 里总会取一次）。
    canvasVersion: MANIFEST.upstream?.tag || null,
    canvasCommit: MANIFEST.upstream?.commit || null,
    payloadVersion: MANIFEST.payloadVersion || null,
    // ADR-0002 决策 4：登录态。required 给视图提示「要重新登录」，storage 让「是否真的加密」可验证。
    session: { present: Boolean(SESSION_TOKEN), storage: SESSION_KEY ? "aes-256-gcm" : "plaintext" },
  };
}

export function servePreparation(req, res) {
  if (req.method === "GET" && req.url === "/api/health/ready") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ status: STATE.phase === "failed" ? "error" : "preparing", ...progressSnapshot() }));
    return;
  }

  if (req.method === "GET" && req.url === "/__canvas/progress") {
    sendJson(res, progressSnapshot());
    return;
  }

  // 插件视图的工具目录：只给名称、说明和分组，不给 inputSchema。
  // 视图只需要回答「这画布能做什么」，协议声明是 /mcp 的事。
  if (req.method === "GET" && req.url === "/__canvas/tools") {
    sendJson(res, {
      tools: MCP_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        group: MCP_TOOL_GROUPS[tool.name] ?? "other",
      })),
    });
    return;
  }

  if (req.method === "POST" && req.url === "/__canvas/retry") {
    STATE.phase = "starting";
    STATE.message = "正在重试";
    clearFailure();
    STATE.receivedBytes = 0;
    STATE.totalBytes = 0;
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    void prepareRuntime();
    return;
  }

  if (req.method === "POST" && req.url === "/mcp") {
    // 后端还没就绪时把 MCP 握手挂住，而不是立刻回 503。多数客户端愿意等，
    // 直接报错会被当成"该服务不支持 MCP"并缓存下来。
    void waitForBackend(MCP_WAIT_MS).then((ready) => {
      if (ready) {
        handleMcpRequest(req, res);
        return;
      }
      res.writeHead(503, { "Content-Type": "application/json", "Retry-After": "10" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32000, message: "Runtime is still preparing" },
        }),
      );
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(progressPage());
}

// --- 模型桥（ADR-0006）---
// 画布只看见一个 OpenAI 兼容端点；真正的推理在插件运行时里用 ctx.ai 执行。
// 为什么是接力而不是直连：这个 shim 能监听端口但没有 ctx，插件运行时反过来。
// 两端各缺一半，队列拼起来才成立。宿主密钥始终不进这个文件、也不进画布配置。
