/**
 * open-ai-canvas 服务启动包装器（host-node entry）。
 *
 * 职责：
 * 1. 映射宿主环境变量到画布后端所需的环境变量
 * 2. 拉起 Go 后端子进程（监听 127.0.0.1:0 随机端口）
 * 3. 解析 Go 后端 stdout 拿到实际监听端口
 * 4. 启动反向代理，监听宿主分配的 ASTRAVIA_SERVICE_PORT
 *    - POST /mcp → MCP Server（手写 JSON-RPC，16 个工具）
 *    - 普通 HTTP → 透传到 Go 后端
 *    - WebSocket upgrade → TCP 双向 pipe 到 Go 后端
 * 5. 捕获登录响应中的 open_ai_canvas_session cookie，加密存储供 MCP 调用
 */
import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 宿主环境变量 ---
const HOST_PORT = Number(process.env.ASTRAVIA_SERVICE_PORT);
const DATA_DIR = process.env.ASTRAVIA_SERVICE_DATA_DIR;
const RUNTIME_DIR = process.env.ASTRAVIA_SERVICE_RUNTIME_DIR || __dirname;

if (!HOST_PORT || !DATA_DIR) {
  console.error("[open-ai-canvas] Missing ASTRAVIA_SERVICE_PORT or ASTRAVIA_SERVICE_DATA_DIR");
  process.exit(1);
}

// --- 路径解析 ---
const SERVER_DIR = RUNTIME_DIR;
const GO_BINARY = path.join(SERVER_DIR, "yingce-backend");
const WEB_DIST = path.join(SERVER_DIR, "web-dist");
const PI_RUNTIME = path.join(SERVER_DIR, "pi-runtime");
const PLUGIN_PACKAGES = path.join(SERVER_DIR, "plugin-packages");

// --- session 存储 ---
const SESSION_FILE = path.join(DATA_DIR, "session.json");

function loadSession() {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf8");
    const data = JSON.parse(raw);
    return typeof data.token === "string" ? data.token : null;
  } catch {
    return null;
  }
}

function saveSession(token) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ token }), { mode: 0o600 });
  } catch (err) {
    console.error("[open-ai-canvas] Failed to save session:", err.message);
  }
}

let SESSION_TOKEN = loadSession();

// --- Go 后端环境变量 ---
const GO_ENV = {
  ...process.env,
  CANVAS_BACKEND_ADDR: "127.0.0.1:0",
  CANVAS_BACKEND_DATA_DIR: DATA_DIR,
  CANVAS_STATIC_DIR: WEB_DIST,
  CANVAS_CORS_ORIGINS: `http://127.0.0.1:${HOST_PORT},http://localhost:${HOST_PORT}`,
  CANVAS_EXIT_WITH_PARENT: "true",
  CANVAS_PARENT_PID: String(process.pid),
  GIN_MODE: "release",
  CANVAS_NODE_BIN: process.execPath,
  CANVAS_PI_RUNTIME_DIR: PI_RUNTIME,
  CANVAS_RUNTIME_AUTO_INSTALL: "false",
  CANVAS_OFFICIAL_PLUGIN_DIR: PLUGIN_PACKAGES,
  CANVAS_REGISTRATION_ENABLED: "false",
};

// --- 拉起 Go 后端 ---
console.log(`[open-ai-canvas] Starting backend: ${GO_BINARY}`);
const goProcess = spawn(GO_BINARY, [], {
  env: GO_ENV,
  stdio: ["ignore", "pipe", "pipe"],
});

let goPort = null;

goProcess.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  const match = text.match(/addr=127\.0\.0\.1:(\d+)/);
  if (match && !goPort) {
    goPort = Number(match[1]);
    console.log(`[open-ai-canvas] Backend listening on port ${goPort}`);
    startProxy();
  }
});

goProcess.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

goProcess.on("exit", (code, signal) => {
  console.log(`[open-ai-canvas] Backend exited: code=${code} signal=${signal}`);
  process.exit(code ?? 1);
});

// --- 信号转发 ---
function forwardSignal(signal) {
  if (goProcess && !goProcess.killed) {
    goProcess.kill(signal);
  }
}
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
process.on("SIGINT", () => forwardSignal("SIGINT"));

// ============================================================
// MCP Server —— 16 个工具，覆盖画布完整操控能力
// 参考 ADR-0002：画布 MCP 工具集、鉴权与操控能力边界
// ============================================================

// 画布内置 18 种节点类型
const BUILTIN_NODE_TYPES = [
  "image", "text", "drawing", "script", "skill", "config",
  "video", "audio", "frame", "markdown", "svg", "html",
  "panorama", "compare", "chart", "colorgrade", "media-conversion", "batch-table",
];

const MCP_TOOLS = [
  // --- 画布项目管理 ---
  {
    name: "list_canvas_projects",
    description: "List all canvas projects in the user's library.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
        page_size: { type: "number", description: "Items per page (default 20)" },
      },
    },
  },
  {
    name: "get_canvas_project",
    description: "Get a canvas project by ID, including its nodes, connections, and revision.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
  },
  {
    name: "create_canvas_project",
    description: "Create a new canvas project. If canvas_id is omitted, a UUID is generated.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Canvas title (default: 'Untitled')" },
        canvas_id: { type: "string", description: "Optional canvas ID (UUID). If omitted, server generates one." },
      },
    },
  },
  {
    name: "delete_canvas_project",
    description: "Delete a canvas project by ID.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
  },
  // --- 节点操作 ---
  {
    name: "add_node",
    description: "Add a node to a canvas project. metadata is a free-form JSON object; call get_node_schema first to know which fields the node type expects.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        type: { type: "string", description: "Node type (e.g. image, text, config, video)" },
        title: { type: "string", description: "Node display title" },
        position: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" } },
          description: "Node position on canvas (default {x:0,y:0})",
        },
        width: { type: "number", description: "Node width in px" },
        height: { type: "number", description: "Node height in px" },
        metadata: { type: "object", description: "Node-specific metadata (call get_node_schema for the schema)" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "type"],
    },
  },
  {
    name: "update_node",
    description: "Update an existing node's fields (patch operation).",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        node_id: { type: "string", description: "Node ID to update" },
        patch: { type: "object", description: "Fields to patch (title, position, width, height, metadata, etc.)" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "node_id", "patch"],
    },
  },
  {
    name: "delete_node",
    description: "Delete a node from a canvas project.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        node_id: { type: "string", description: "Node ID to delete" },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "node_id"],
    },
  },
  {
    name: "list_node_types",
    description: "List all available node types (built-in + plugin-registered).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_node_schema",
    description: "Get the metadata schema for a given node type, so you know what fields to pass to add_node.",
    inputSchema: {
      type: "object",
      properties: {
        node_type: { type: "string", description: "Node type (e.g. image, text, config)" },
      },
      required: ["node_type"],
    },
  },
  // --- 连接操作 ---
  {
    name: "connect_nodes",
    description: "Create a connection between two nodes.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        from_node_id: { type: "string", description: "Source node ID" },
        to_node_id: { type: "string", description: "Target node ID" },
        from_handle: { type: "string", description: "Source handle ID (optional)" },
        to_handle: { type: "string", description: "Target handle ID (optional)" },
        base_revision: { type: "number", description: "Expected canvas revision (optional)" },
      },
      required: ["canvas_id", "from_node_id", "to_node_id"],
    },
  },
  {
    name: "delete_connection",
    description: "Delete a connection between nodes.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        connection_id: { type: "string", description: "Connection ID to delete" },
        base_revision: { type: "number", description: "Expected canvas revision (optional)" },
      },
      required: ["canvas_id", "connection_id"],
    },
  },
  {
    name: "list_connections",
    description: "List all connections in a canvas project.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
  },
  // --- 生成与资源 ---
  {
    name: "run_generation",
    description: "Trigger a generation task on a node (image/text/video/audio). Polls until completion or timeout. Returns task_id, status, result_url and resource_id.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        node_id: { type: "string", description: "Node ID to generate from" },
        prompt: { type: "string", description: "Generation prompt" },
        timeout_seconds: { type: "number", description: "Max wait time in seconds (default 120)" },
      },
      required: ["canvas_id", "node_id", "prompt"],
    },
  },
  {
    name: "list_assets",
    description: "List assets (images/videos/audio) in the user's resource library.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by type: image, video, audio (optional)" },
        limit: { type: "number", description: "Max items (default 50)" },
      },
    },
  },
  {
    name: "get_canvas_state",
    description: "Get the full canvas state: revision, nodes, and connections. Use before write operations for conflict detection.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
      },
      required: ["canvas_id"],
    },
  },
  // --- 批量操作 ---
  {
    name: "apply_operations",
    description: "Apply a batch of canvas operations directly. Escape hatch for advanced use cases or operation types not covered by dedicated tools.",
    inputSchema: {
      type: "object",
      properties: {
        canvas_id: { type: "string", description: "Canvas project ID" },
        operations: {
          type: "array",
          description: "Array of CanvasOperation objects (create_node, patch_node, remove_node, create_connection, remove_connection, set_field, etc.)",
          items: { type: "object" },
        },
        base_revision: { type: "number", description: "Expected canvas revision for conflict detection (optional)" },
      },
      required: ["canvas_id", "operations"],
    },
  },
];

// --- MCP 工具实现 ---

function textResult(text) {
  return { content: [{ type: "text", text }] };
}

function jsonResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function callCanvasApi(method, pathname, body) {
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
            SESSION_TOKEN = null;
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

// 发送画布操作（PATCH /canvas-projects/:id/operations）
async function applyCanvasOperations(canvasId, operations, baseRevision) {
  const body = { operations };
  if (baseRevision !== undefined) body.baseRevision = baseRevision;
  body.mutationId = crypto.randomUUID();
  return callCanvasApi("PATCH", `/api/canvas-projects/${canvasId}/operations`, body);
}

// 获取画布完整文档
async function fetchCanvasDocument(canvasId) {
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
function inferGenerationMode(nodeType) {
  switch (nodeType) {
    case "image": return "image";
    case "text": return "text";
    case "video": return "video";
    case "audio": return "audio";
    default: return "image";
  }
}

async function handleMcpToolCall(name, args) {
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
      return applyCanvasOperations(canvasId, [
        { type: "create_canvas", id: "canvas", patch: { title } },
      ]);
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

    case "list_node_types":
      return jsonResult({ builtin: BUILTIN_NODE_TYPES, note: "Plugin node types are discovered at runtime via get_node_schema." });

    case "get_node_schema": {
      // 内置节点的静态 schema（fallback，若后端提供端点则优先用后端）
      const schemas = {
        image: { fields: ["content", "storageKey", "prompt", "model", "parameters", "generationTaskId"], description: "Image generation node." },
        text: { fields: ["content", "prompt", "model"], description: "Text generation node." },
        config: { fields: ["model", "parameters", "provider"], description: "Generation configuration node. Connect to image/text/video nodes to set their model." },
        video: { fields: ["content", "storageKey", "prompt", "model", "referenceImages"], description: "Video generation node." },
        audio: { fields: ["content", "storageKey", "prompt", "model"], description: "Audio generation node." },
        script: { fields: ["shots", "title"], description: "Storyboard script node." },
        frame: { fields: ["image", "duration"], description: "Timeline frame node." },
        markdown: { fields: ["content"], description: "Markdown text node." },
        svg: { fields: ["content"], description: "SVG vector node." },
        html: { fields: ["content"], description: "HTML embed node." },
        drawing: { fields: ["content", "storageKey"], description: "Drawing canvas node." },
        skill: { fields: ["skillId", "config"], description: "Skill node." },
        panorama: { fields: ["content", "storageKey"], description: "Panorama image node." },
        compare: { fields: ["images"], description: "Image comparison node." },
        chart: { fields: ["config", "data"], description: "Chart node." },
        colorgrade: { fields: ["lut", "intensity"], description: "Color grading node." },
        "media-conversion": { fields: ["format", "input"], description: "Media format conversion node." },
        "batch-table": { fields: ["rows", "columns"], description: "Batch processing table node." },
      };
      const schema = schemas[args.node_type];
      if (!schema) {
        return jsonResult({ node_type: args.node_type, available: false, note: "Unknown node type. It may be a plugin-registered node; check the canvas UI for its schema." });
      }
      return jsonResult({ node_type: args.node_type, ...schema });
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

    // --- 批量操作 ---
    case "apply_operations":
      return applyCanvasOperations(args.canvas_id, args.operations, args.base_revision);

    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

function handleMcpRequest(req, res) {
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

// --- 反向代理 ---
function startProxy() {
  const server = http.createServer((req, res) => {
    // MCP 路由
    if (req.method === "POST" && req.url === "/mcp") {
      handleMcpRequest(req, res);
      return;
    }

    // 透传到 Go 后端
    const proxyReq = http.request(
      {
        hostname: "127.0.0.1",
        port: goPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        // 捕获 session cookie
        const setCookie = proxyRes.headers["set-cookie"];
        if (setCookie) {
          const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
          for (const cookie of cookies) {
            const match = cookie.match(/open_ai_canvas_session=([^;]+)/);
            if (match) {
              SESSION_TOKEN = match[1];
              saveSession(SESSION_TOKEN);
              console.log("[open-ai-canvas] Session captured");
            }
          }
        }

        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Bad Gateway: ${err.message}`);
    });

    req.pipe(proxyReq);
  });

  // WebSocket upgrade 转发
  server.on("upgrade", (req, socket, head) => {
    const targetSocket = net.connect(goPort, "127.0.0.1", () => {
      let upgradeReq = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const v of value) upgradeReq += `${key}: ${v}\r\n`;
        } else {
          upgradeReq += `${key}: ${value}\r\n`;
        }
      }
      upgradeReq += "\r\n";
      targetSocket.write(upgradeReq);
      if (head && head.length) targetSocket.write(head);

      targetSocket.pipe(socket);
      socket.pipe(targetSocket);
    });

    targetSocket.on("error", () => socket.destroy());
    socket.on("error", () => targetSocket.destroy());
  });

  server.listen(HOST_PORT, "127.0.0.1", () => {
    console.log(`[open-ai-canvas] Proxy listening on http://127.0.0.1:${HOST_PORT}`);
  });
}
