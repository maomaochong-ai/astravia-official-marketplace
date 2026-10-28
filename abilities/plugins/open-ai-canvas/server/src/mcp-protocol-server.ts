/**
 * MCP 协议层与工具实现（手写 JSON-RPC 2.0）
 *
 * 由 server/src/boot.ts 按职责切出（ADR-0012）。
 */
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC_ORIGIN } from "./stable-origin-binding.ts";
import { note } from "./preparation-state.ts";
import { SESSION_FILE, SESSION_TOKEN, setSessionToken } from "./canvas-session-store.ts";
import { backendReady, goPort } from "./backend-process.ts";
import { LAST_WORKFLOW, compileWorkflow, setLastWorkflow } from "./workflow-compiler.ts";
import { MCP_TOOLS } from "./mcp-tool-catalog.ts";
import { BUILTIN_NODE_TYPES, NODE_SCHEMAS } from "./canvas-node-contract.ts";
import { callSkillTool } from "./canvas-skill-library.ts";

// MCP 工具返回体的最小形状：成功只有 content，失败额外带 isError。
export type ToolResult = {
  content: Array<{ type: string; text: string }>;
  isError?: true;
};

/** 技能库工具的传输端口：技能模块只要求「发一个带会话的请求」（ADR-0016）。 */
const SKILL_API_PORT = { request: rawCanvasApi };

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function jsonResult(data: any): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

// 画布在浏览器里的地址。宿主端口每次都变，所以用它拼出来的链接写进对话、写进收藏
// 之后就会准时失效；改用固定 origin（搬不到时自动退回宿主端口）。ADR-0010。
export function canvasUrl(canvasId) {
  return `${PUBLIC_ORIGIN}/canvas/${canvasId}`;
}

// 把后端返回的 {"code":0,"data":{...},"msg":"ok"} 展开，并把画布地址一并给出。
export function withCanvasUrl(result, canvasId) {
  if (!result || result.isError) return result;
  const raw = result.content?.[0]?.text;
  if (typeof raw !== "string") return result;
  try {
    const parsed = JSON.parse(raw);
    const payload = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
    payload.url = canvasUrl(canvasId);
    return jsonResult(parsed.data ? parsed : payload);
  } catch {
    return result;
  }
}

export async function callCanvasApi(method: string, pathname: string, body?: any): Promise<ToolResult> {
  if (!SESSION_TOKEN) {
    return errorResult("No active session. Please open the canvas in a browser and log in first. The session is captured automatically after login.");
  }
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: goPort,
        path: pathname,
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: `open_ai_canvas_session=${SESSION_TOKEN}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 401) {
            setSessionToken(null);
            try { fs.unlinkSync(SESSION_FILE); } catch {}
            resolve(errorResult("Session expired. Please open the canvas in a browser and log in again."));
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            resolve(errorResult(`API ${res.statusCode}: ${data || "request failed"}`));
            return;
          }
          resolve({ content: [{ type: "text", text: data || `Status: ${res.statusCode}` }] });
        });
      }
    );
    req.on("error", (err) => {
      resolve(errorResult(`API error: ${err.message}`));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
/**
 * 和 callCanvasApi 同样带会话，但把状态码原样交回来。
 *
 * 渠道管理要区分「没登录」和「写失败」：前者该引导用户登录，后者该把画布的原话
 * 报给用户。callCanvasApi 把所有错误压成一句话，这里不够用。
 */
export async function rawCanvasApi(
  method: string,
  pathname: string,
  body?: any,
): Promise<{ status: number; body: any }> {
  if (!SESSION_TOKEN) return { status: 401, body: { code: "canvas-login-required" } };
  return new Promise<{ status: number; body: any }>((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: goPort,
        path: pathname,
        method,
        headers: { "Content-Type": "application/json", Cookie: `open_ai_canvas_session=${SESSION_TOKEN}` },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode === 401) {
            setSessionToken(null);
            try { fs.unlinkSync(SESSION_FILE); } catch {}
            resolve({ status: 401, body: { code: "canvas-login-required" } });
            return;
          }
          let parsed;
          try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );
    req.on("error", (err) => resolve({ status: 502, body: { code: "canvas-unreachable", message: err.message } }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 画布后端自报的节点类型（ADR-0002 决策 2）。
 *
 * 上游 GET /api/agent/capabilities 只返回类型名（CloudAgentCapabilitySet.Nodes 是 []string），
 * 没有 per-type schema——所以这里能拿到的是「有哪些类型」，不是「每种类型长什么样」。
 * 拿不到（未登录、后端未就绪、上游版本大旧）返回 null，调用方退回内置表并如实报出。
 */
export async function runtimeNodeTypes() {
  const { status, body } = await rawCanvasApi("GET", "/api/agent/capabilities");
  if (status !== 200) return null;
  const types = body?.nodeTypes;
  if (!Array.isArray(types)) return null;
  return types.filter((name) => typeof name === "string" && name);
}

/**
 * 画布渠道的创建/更新（ADR-0006 决策 2）。
 *
 * 渠道是 system scope，密钥入库后不可再读回（publicChannel 对 system scope 只返回
 * "system" 占位），所以更新时把同一个 token 再写一次——它本来就是本地随机串，重写无害。
 */
export async function bridgeAdminChannels(method, channelId, payload) {
  if (method === "GET") {
    const result = await rawCanvasApi("GET", "/api/admin/channels?page=1&limit=100");
    return { status: result.status, body: result.body };
  }
  if (method === "POST") {
    return rawCanvasApi("POST", "/api/admin/channels", payload);
  }
  if (method === "PATCH" && channelId) {
    return rawCanvasApi("PATCH", `/api/admin/channels/${channelId}`, payload);
  }
  return { status: 400, body: { code: "bridge-bad-request", message: "unsupported channel operation" } };
}

/**
 * 画布渠道模型（ADR-0015）。
 *
 * 为什么不建渠道时一并传 `models`：那条路径落到 `syncInitialChannelModels`，建出来的行是
 * `Enabled: false` / `PriceConfigured: false` / 无能力配置，创作目录直接把它过滤掉。
 * 逐条写 `SaveAdminChannelModel` 才会拿到 `Enabled: true` 的默认值。
 */
export async function bridgeAdminChannelModels(method: string, channelId?: string, modelId?: string, payload?: any) {
  if (!channelId) {
    return { status: 400, body: { code: "bridge-bad-request", message: "channel id is required" } };
  }
  const base = `/api/admin/channels/${channelId}/models`;
  if (method === "GET") return rawCanvasApi("GET", base);
  if (method === "POST") return rawCanvasApi("POST", base, payload);
  if (method === "PATCH" && modelId) return rawCanvasApi("PATCH", `${base}/${modelId}`, payload);
  if (method === "DELETE" && modelId) return rawCanvasApi("DELETE", `${base}/${modelId}`);
  return { status: 400, body: { code: "bridge-bad-request", message: "unsupported channel model operation" } };
}

/**
 * 创作目录读回（ADR-0015 决策 4）。
 *
 * 走的是画布 UI 自己那条 `GET /api/model-catalog`：只有这张响应能回答「用户看得见吗」。
 * shim 不在这里判断可不可用——分类留给调用方（`channel-projection.ts`），免得把上游的
 * 过滤规则抄一份到 shim。
 */
export async function readCanvasModelCatalog() {
  return rawCanvasApi("GET", "/api/model-catalog");
}

// 发送画布操作（PATCH /canvas-projects/:id/operations）
export async function applyCanvasOperations(canvasId: string, operations: any[], baseRevision?: any) {
  const body: any = { operations };
  if (baseRevision !== undefined) body.baseRevision = baseRevision;
  body.mutationId = crypto.randomUUID();
  return callCanvasApi("PATCH", `/api/canvas-projects/${canvasId}/operations`, body);
}

// 获取画布完整文档
export async function fetchCanvasDocument(canvasId) {
  const result = await callCanvasApi("GET", `/api/canvas-projects/${canvasId}`);
  if (result.isError) return result;
  try {
    const parsed = JSON.parse(result.content[0].text);
    return parsed;
  } catch {
    return errorResult("Failed to parse canvas project response.");
  }
}

// 从节点类型推断生成 mode
export function inferGenerationMode(nodeType) {
  switch (nodeType) {
    case "image": return "image";
    case "text": return "text";
    case "video": return "video";
    case "audio": return "audio";
    default: return "image";
  }
}

export async function handleMcpToolCall(name, args) {
  switch (name) {
    // --- 画布项目管理 ---
    case "list_canvas_projects": {
      const params = new URLSearchParams();
      if (args.page) params.set("page", String(args.page));
      if (args.page_size) params.set("pageSize", String(args.page_size));
      return callCanvasApi("GET", `/api/canvas-projects?${params.toString()}`);
    }

    case "get_canvas_project":
      return callCanvasApi("GET", `/api/canvas-projects/${args.canvas_id}`);

    case "create_canvas_project": {
      const canvasId = args.canvas_id || crypto.randomUUID();
      const title = args.title || "Untitled";
      // create_canvas 操作的 id 必须等于 URL 里的画布 id，后端会做一致性校验
      // （写成固定的 "canvas" 会被拒绝：画布创建操作的 ID 与请求路径不一致）。
      const created = await applyCanvasOperations(canvasId, [
        { type: "create_canvas", id: canvasId, patch: { title } },
      ]);
      return withCanvasUrl(created, canvasId);
    }

    case "delete_canvas_project":
      return callCanvasApi("DELETE", `/api/canvas-projects/${args.canvas_id}`);

    // --- 节点操作 ---
    case "add_node": {
      const nodeId = crypto.randomUUID();
      const operation = {
        type: "create_node",
        id: nodeId,
        node: {
          id: nodeId,
          type: args.type,
          title: args.title || args.type,
          position: args.position || { x: 0, y: 0 },
          ...(args.width !== undefined && { width: args.width }),
          ...(args.height !== undefined && { height: args.height }),
          metadata: args.metadata || {},
        },
      };
      return applyCanvasOperations(args.canvas_id, [operation], args.base_revision);
    }

    case "update_node": {
      const operation = {
        type: "patch_node",
        id: args.node_id,
        patch: args.patch,
      };
      return applyCanvasOperations(args.canvas_id, [operation], args.base_revision);
    }

    case "delete_node": {
      return applyCanvasOperations(args.canvas_id, [
        { type: "remove_node", id: args.node_id },
      ], args.base_revision);
    }

    case "list_node_types": {
      // ADR-0002 决策 2：类型清单以画布后端为准（GET /api/agent/capabilities 的 nodeTypes）。
      // 旧实现只回内置 18 种，note 却说「运行时通过 get_node_schema 发现」——两头都是错的。
      const runtime = await runtimeNodeTypes();
      const merged = [...new Set([...BUILTIN_NODE_TYPES, ...(runtime ?? [])])];
      return jsonResult({
        // builtin 是插件能给出字段 schema 的那批；runtime 是后端本次自报的完整清单。
        builtin: BUILTIN_NODE_TYPES,
        runtime: runtime ?? [],
        all: merged,
        discovered: runtime !== null,
        note: runtime === null
          ? "The canvas backend did not expose /api/agent/capabilities, so only the builtin list is shown. Node types added by the running canvas are missing here."
          : "`runtime` is the canvas backend's own node-type list; `builtin` is the subset this plugin can describe with a field schema.",
      });
    }

    case "get_node_schema": {
      const schema = NODE_SCHEMAS[args.node_type];
      if (schema) return jsonResult({ node_type: args.node_type, source: "builtin", available: true, ...schema });
      // 后端只暴露类型名，没有 per-type schema 接口（ADR-0002 决策 2 的 fallback 情形），
      // 所以对运行时节点只能回答「它存在，但 schema 拿不到」，不能编一个出来。
      const runtime = await runtimeNodeTypes();
      const registered = Array.isArray(runtime) && runtime.includes(args.node_type);
      return jsonResult({
        node_type: args.node_type,
        available: false,
        registered,
        source: registered ? "runtime" : "none",
        note: registered
          ? "This node type is registered by the canvas runtime, but the backend exposes no per-type field schema. Read an existing node of this type (get_canvas_project) to see its shape."
          : "Unknown node type: neither in the builtin schema set nor reported by the canvas backend.",
      });
    }

    // --- 声明式编排（ADR-0007）---
    case "apply_workflow": {
      // 先读当前图：幂等（按 __key）与连线去重都依赖它。读不到就直报错——
      // 在不知道现有节点的情况下提交 create_node 会把节点再造一份。
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const payload = doc.project?.payload || doc;
      const existing = { nodes: payload.nodes || [], connections: payload.connections || [] };

      let compiled;
      try {
        compiled = compileWorkflow(args.workflow, existing);
      } catch (err) {
        return errorResult(`${err.code || "workflow-invalid"}: ${err.message}`);
      }

      if (compiled.operations.length === 0) {
        return jsonResult({ applied: false, reason: "nothing-to-do", mapping: compiled.mapping, depth: compiled.depth });
      }

      const baseRevision = args.base_revision ?? payload.revision;
      const applied = await applyCanvasOperations(args.canvas_id, compiled.operations, baseRevision);
      if (applied.isError) {
        // 409 是 revision 冲突：把当前 revision 一起告诉调用方，方便它读完重试。
        const text = applied.content?.[0]?.text ?? "";
        if (/\b409\b|revision/i.test(text)) {
          return errorResult(`revision_conflict: ${text}（当前 revision ${payload.revision}，请重新读取后再提交）`);
        }
        return applied;
      }

      // 生成需要显式开启：一句「搭 20 镜分镜」不该把 20 次付费生成打出去。
      const runTargets = args.run
        ? (args.workflow.nodes ?? []).filter((node) => node?.run === true)
        : [];
      const results = [];
      for (const node of runTargets) {
        const nodeId = compiled.mapping[node.key];
        if (!nodeId) continue;
        const result = await handleMcpToolCall("run_generation", {
          canvas_id: args.canvas_id,
          node_id: nodeId,
          prompt: node.metadata?.prompt || node.metadata?.content || node.title || "",
        });
        results.push({ key: node.key, node_id: nodeId, ...(result.isError ? { error: result.content[0].text } : {}) });
      }

      // 记一笔最近一次应用，供插件视图显示（ADR-0007 决策 5）：用户点不点、agent 做了什么，
      // 应当在界面里能看到，而不是只能靠读会话记录。
      setLastWorkflow({
        at: Date.now(),
        canvasId: args.canvas_id,
        revision: baseRevision + 1,
        nodes: (args.workflow.nodes ?? []).length,
        edges: (args.workflow.edges ?? []).length,
        operations: compiled.operations.length,
        generationCount: results.length,
        idempotent: compiled.operations.every((operation) => operation.type !== "create_node"),
      });

      return withCanvasUrl(
        jsonResult({
          applied: true,
          revision: baseRevision + 1,
          nodes: (args.workflow.nodes ?? []).length,
          edges: (args.workflow.edges ?? []).length,
          operations: compiled.operations.length,
          mapping: compiled.mapping,
          depth: compiled.depth,
          ...(results.length > 0 && { generations: results }),
        }),
        args.canvas_id,
      );
    }

    case "export_workflow": {
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const payload = doc.project?.payload || doc;
      const nodes = payload.nodes || [];
      const connections = payload.connections || [];
      const keyOf = (node) => node?.metadata?.__key || node.id;
      const workflow = {
        nodes: nodes.map((node) => ({
          key: keyOf(node),
          type: node.type,
          title: node.title,
          position: node.position,
          ...(node.width !== undefined && { width: node.width }),
          ...(node.height !== undefined && { height: node.height }),
          metadata: Object.fromEntries(Object.entries(node.metadata ?? {}).filter(([name]) => name !== "__key")),
        })),
        edges: connections.map((conn) => ({
          from: keyOf(nodes.find((node) => node.id === conn.fromNodeId) ?? { id: conn.fromNodeId }),
          to: keyOf(nodes.find((node) => node.id === conn.toNodeId) ?? { id: conn.toNodeId }),
        })),
      };
      return jsonResult({ revision: payload.revision, workflow });
    }

    // --- 连接操作 ---
    case "connect_nodes": {
      const connectionId = crypto.randomUUID();
      return applyCanvasOperations(args.canvas_id, [
        {
          type: "create_connection",
          id: connectionId,
          connection: {
            id: connectionId,
            fromNodeId: args.from_node_id,
            toNodeId: args.to_node_id,
            ...(args.from_handle && { fromHandleId: args.from_handle }),
            ...(args.to_handle && { toHandleId: args.to_handle }),
          },
        },
      ], args.base_revision);
    }

    case "delete_connection": {
      return applyCanvasOperations(args.canvas_id, [
        { type: "remove_connection", id: args.connection_id },
      ], args.base_revision);
    }

    case "list_connections": {
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const connections = doc.project?.payload?.connections || doc.connections || [];
      return jsonResult({ connections });
    }

    // --- 生成与资源 ---
    case "run_generation": {
      // 1. 读取节点 config
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const nodes = doc.project?.payload?.nodes || doc.nodes || [];
      const node = nodes.find((n) => n.id === args.node_id);
      if (!node) return errorResult(`Node ${args.node_id} not found in canvas.`);

      const mode = inferGenerationMode(node.type);
      const config = node.metadata?.config || node.metadata || {};
      const model = config.model || "";

      // 2. 提交生成任务
      const taskBody = {
        type: `canvas_${mode}`,
        operation: mode,
        prompt: args.prompt,
        ...(model && { model }),
        input: { mode, prompt: args.prompt, config },
      };
      const taskResult = await callCanvasApi("POST", "/api/tasks", taskBody);
      if (taskResult.isError) return taskResult;

      let task;
      try {
        task = JSON.parse(taskResult.content[0].text);
      } catch {
        return errorResult("Failed to parse task creation response.");
      }
      const taskId = task.id;
      if (!taskId) return errorResult("Task creation did not return an id.");

      // 3. 轮询任务状态
      const timeoutMs = (args.timeout_seconds || 120) * 1000;
      const deadline = Date.now() + timeoutMs;
      const pollIntervalMs = 2000;
      let finalResult = null;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        const statusResult = await callCanvasApi("GET", `/api/tasks/${taskId}`);
        if (statusResult.isError) return statusResult;
        let status;
        try {
          status = JSON.parse(statusResult.content[0].text);
        } catch {
          continue;
        }
        finalResult = status;
        const statusLower = String(status.status || "").toLowerCase();
        if (["succeeded", "completed", "success", "failed", "cancelled", "canceled"].includes(statusLower)) {
          break;
        }
      }

      if (!finalResult) {
        return jsonResult({ task_id: taskId, status: "timeout", note: "Task did not complete within the timeout. Use get_task to check later." });
      }

      // 4. 提取结果 URL 和 resource_id
      const resultUrl = finalResult.outputUrl || finalResult.resultUrl || finalResult.url || finalResult.output?.url || null;
      const resourceId = finalResult.resourceId || finalResult.outputResourceId || finalResult.output?.resourceId || null;

      return jsonResult({
        task_id: taskId,
        status: finalResult.status,
        result_url: resultUrl,
        resource_id: resourceId,
        raw: finalResult,
      });
    }

    case "list_assets": {
      const params = new URLSearchParams();
      if (args.type) params.set("type", args.type);
      if (args.limit) params.set("limit", String(args.limit));
      return callCanvasApi("GET", `/api/resources?${params.toString()}`);
    }

    case "get_canvas_state": {
      const doc = await fetchCanvasDocument(args.canvas_id);
      if (doc.isError) return doc;
      const payload = doc.project?.payload || doc;
      return jsonResult({
        revision: payload.revision ?? doc.project?.revision,
        nodes: payload.nodes || [],
        connections: payload.connections || [],
      });
    }

    // --- 工作区与任务（ADR-0002 决策 6、ADR-0001 决策 7）---
    case "list_workspace_projects": {
      const query = new URLSearchParams();
      query.set("page", String(args.page ?? 1));
      query.set("pageSize", String(args.page_size ?? 50));
      // 上游只有 GET /api/projects（列表）与 POST /api/projects（新建），没有单条详情路由，
      // 所以这里只做列表，不造一个上游没有的 get_project。
      return callCanvasApi("GET", `/api/projects?${query.toString()}`);
    }

    case "get_task": {
      // run_generation 超时会回 task_id 并让调用方“用 get_task 查”——以前那个工具根本不存在。
      // 缺参时直接拒：否则拼出 /api/tasks/undefined，上游只会回一个含糊的 404。
      if (!args.task_id) return errorResult("task_id is required");
      return callCanvasApi("GET", `/api/tasks/${encodeURIComponent(args.task_id)}`);
    }

    // --- 技能库（ADR-0016）---
    // 语义全在 canvas-skill-library.ts：这里只把「这个名字归它」和带会话的传输函数交出去，
    // 免得协议层再长出一套自己的裁剪与报错规则。
    case "list_skills":
    case "get_skill":
    case "list_skill_files":
    case "read_skill_file":
    case "search_skill_files":
    case "list_added_skills":
    case "set_skill_added":
    case "list_skill_presets":
      return callSkillTool(name, args, SKILL_API_PORT);

    // --- 批量操作 ---
    case "apply_operations":
      return applyCanvasOperations(args.canvas_id, args.operations, args.base_revision);

    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

export function handleMcpRequest(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    let rpc;
    try {
      rpc = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
      return;
    }

    const { method, id, params } = rpc;

    if (method === "initialize") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: { name: "open-ai-canvas", version: "0.1.0" },
            capabilities: { tools: {} },
          },
        })
      );
      return;
    }

    if (method === "tools/list") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } }));
      return;
    }

    if (method === "tools/call") {
      const { name, arguments: toolArgs } = params || {};
      const result = await handleMcpToolCall(name, toolArgs || {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }));
  });
}

// --- 反向代理壳 ---
// 先监听、再准备：宿主的 /api/health/ready 一连接就能拿到 200，首次启动那 200 MB
// 下载与解包因此不再卡在宿主的健康超时里被反复中止。准备完成前，界面拿到的是
// 插件自己画的进度页，MCP 请求则等后端就绪（最多 90 秒）再交给真实处理器。
export const MCP_WAIT_MS = 90_000;

export function waitForBackend(timeoutMs) {
  if (goPort) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    backendReady.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

// 本机运维状态都用同一份响应头：不缓存，且允许宿主渲染进程（另一个 origin）读。
// 里面只有准备进度与失败原因，不含会话 token。
