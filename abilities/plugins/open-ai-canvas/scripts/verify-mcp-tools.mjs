#!/usr/bin/env node
/**
 * 用真实 shim 进程验证 MCP 工具契约（ADR-0002 验证节、决策 2 / 4 / 6）。
 *
 * 为什么需要这个脚本：ADR-0002 承诺的是一个**契约**——握手、工具清单、参数 schema、
 * 未知工具/未知方法/坏 JSON 的失败形状、以及「没有会话时 MCP 工具不能替用户调上游」。
 * 这些以前只能靠人翻代码确认；工具清单从 18 涨到 20、`get_node_schema` 的语义被改写，
 * 都没有回归保护。
 *
 * 做法与 verify-stable-origin 一致：不假装外部环境。
 * - `ASTRAVIA_SERVICE_RUNTIME_DIR` 指向临时目录，内放假的 `web-dist/` 与真的监听端口的
 *   `yingce-backend`（按路径回不同 JSON，并把收到的 Cookie 回显出来），于是
 *   `resolveRuntimeDir()` 直接命中「随包运行时」；
 * - `CANVAS_PAYLOAD_MANIFEST` 指向只声明本机平台的清单，Agent 载荷确定缺席，不碰网络；
 * - `CANVAS_STABLE_PORTS: "off"`：本脚本关心协议层，不掺 origin 钉定。
 *
 * 两段式：先起一个**没有会话**的 shim（验证匿名时的拒绝形状），停掉，写入升级前的
 * v1 明文 session.json，再起第二个（验证 v1 → v2 就地升级、解出的 token 真的进了上游
 * 请求头、节点清单来自后端自报）。
 */
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path, { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// 与 verify-stable-origin.mjs 同一约定：可以把被测对象换成一个旧 shim，用来证明这些断言真的会红。
const SHIM = process.env.CANVAS_SHIM_UNDER_TEST
  ? path.resolve(process.env.CANVAS_SHIM_UNDER_TEST)
  : join(ROOT, "server", "boot.mjs");
const TIMEOUT_MS = 30_000;
const PLATFORM = `${process.platform === "win32" ? "win32" : process.platform}-${process.arch}`;
const SESSION_TOKEN = "verify-mcp-tools-token";

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(predicate, label, timeoutMs = TIMEOUT_MS) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`timeout waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

/**
 * 假后端：按路径回答本脚本关心的事实。
 * `/api/agent/capabilities` 故意只给类型名（真实上游就是这样），用来验证插件不会编 schema；
 * `/api/projects` 把收到的 Cookie 回显出来，用来证明「解出来的会话真的进了上游请求」；
 * `/api/skills*` 把收到的路径与查询串写进技能名里，于是「参数有没有真的映射到上游
 * 查询串」可以只靠工具返回的 JSON 判定，不必给被测实现加测试专用字段。
 */
const FAKE_BACKEND = `#!/usr/bin/env node
const http = require("node:http");
const addr = process.env.CANVAS_BACKEND_ADDR || "127.0.0.1:0";
const port = Number(addr.split(":").pop());
const skillItem = (name, extra) =>
  Object.assign(
    {
      skillId: "yingce-shot-grammar",
      skillName: name,
      description: "镜头语言与分镜卡片",
      instruction: "",
      versionId: "v-1",
      version: "1.0.0",
      fileCount: 29,
      totalBytes: 91000,
      tag: "drama",
      status: 1,
      sortWeight: 10,
      isPrivate: false,
      likeCount: 7,
      addedCount: 31,
      isAdded: false,
      isLike: false,
      isOwner: false,
      markdownUrl: "/api/skills/yingce-shot-grammar/file/raw?path=SKILL.md",
      libraryCategoryId: "",
    },
    extra || {},
  );
const server = http.createServer((req, res) => {
  const url = req.url || "/";
  const send = (code, body) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.startsWith("/api/skills")) {
    const [pathPart, queryPart] = url.split("?");
    const rest = pathPart.split("/").filter(Boolean).slice(2);
    const query = new URLSearchParams(queryPart || "");
    if (rest.length === 0 && req.method === "GET") {
      return send(200, { code: 0, msg: "ok", data: {
        skills: [skillItem(url)],
        totalCount: 73,
        hasMore: true,
        nextOffset: 20,
        page: 1,
        pageSize: 20,
        categories: [{ key: "drama", label: "短剧影视", count: 26 }],
      } });
    }
    if (rest.length === 1 && rest[0] === "presets") {
      return send(200, { code: 0, msg: "ok", data: { presets: [{
        presetId: "product-film",
        name: "产品短片",
        scene: "ecommerce",
        skillIds: ["yingce-product-ad"],
        rationale: "15 秒产品片需要分镜 + 广告打法",
        source: "seed",
        evidence: ["E1"],
        upgrade: "",
      }] } });
    }
    if (rest.length === 1 && rest[0] === "added") {
      return send(200, { code: 0, msg: "ok", data: { skills: [skillItem(url, { isAdded: true })] } });
    }
    const id = decodeURIComponent(rest[0]);
    if (rest.length === 1 && req.method === "GET") {
      if (id === "gone") return send(404, { code: 404, msg: "技能不存在或已删除" });
      return send(200, { code: 0, msg: "ok", data: skillItem("分镜语法", {
        skillId: id,
        instruction: "# " + id + String.fromCharCode(10) + "x".repeat(400),
      }) });
    }
    if (rest[1] === "files") {
      return send(200, { code: 0, msg: "ok", data: { files: [
        { path: "SKILL.md", kind: "markdown", mimeType: "text/markdown", size: 120, sha256: "a" },
        { path: "cards/shot-grammar.md", kind: "markdown", mimeType: "text/markdown", size: 200, sha256: "b" },
      ] } });
    }
    if (rest[1] === "file") {
      const wantPath = query.get("path") || "";
      return send(200, { code: 0, msg: "ok", data: { file: {
        file: { path: wantPath, kind: "markdown", mimeType: "text/markdown", size: 12, sha256: "c" },
        content: "content of " + wantPath,
        binary: false,
      } } });
    }
    if (rest[1] === "search") {
      return send(200, { code: 0, msg: "ok", data: { results: [
        { path: "cards/shot-grammar.md", line: 12, snippet: "snippet for " + (query.get("q") || "") },
      ] } });
    }
    if (rest[1] === "add") {
      return send(200, { code: 0, msg: "ok", data: skillItem(req.method + " " + pathPart, {
        skillId: id,
        isAdded: req.method === "POST",
      }) });
    }
    return send(200, { code: 0, msg: "ok", data: {} });
  }
  if (url.startsWith("/api/agent/capabilities")) {
    return send(200, { nodeTypes: ["runtime_only_node"], version: "v-fake", hash: "h" });
  }
  if (url.startsWith("/api/projects")) {
    return send(200, { projects: [], page: 1, pageSize: 50, sessionCookie: req.headers.cookie || null });
  }
  if (url.startsWith("/api/tasks/")) {
    return send(200, { task_id: decodeURIComponent(url.split("/").pop()), status: "completed" });
  }
  return send(200, { fakeBackend: true, path: url });
});
server.listen(port, "127.0.0.1", () => {
  process.stdout.write('time=2026-01-01T00:00:00Z level=INFO msg="backend listening" addr=127.0.0.1:' + server.address().port + "\\n");
});
`;

function writeManifest(dir) {
  const manifestPath = join(dir, "payload-manifest.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        payloadVersion: "verify-mcp-tools",
        upstream: { repository: "ddcat-ai/open-ai-canvas", tag: "v0.0.0-verify", commit: "0".repeat(40) },
        platforms: {
          [PLATFORM]: {
            payload: { file: "payload-verify-mcp-tools.zip", sha256: "0".repeat(64), bytes: 1 },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  return manifestPath;
}

function buildRuntime() {
  const dir = mkdtempSync(join(tmpdir(), "verify-mcp-tools-"));
  const runtimeDir = join(dir, "runtime");
  const dataDir = join(dir, "data");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(runtimeDir, { recursive: true });

  const binary = join(runtimeDir, "yingce-backend");
  writeFileSync(binary, FAKE_BACKEND);
  chmodSync(binary, 0o755);

  const webDir = join(runtimeDir, "web-dist");
  mkdirSync(join(webDir, "assets"), { recursive: true });
  writeFileSync(join(webDir, "index.html"), "<!doctype html><title>canvas</title><div id=root></div>\n");
  writeFileSync(join(webDir, "assets", "app-abc123.js"), "console.log('canvas bundle');\n");

  return { dir, runtimeDir, dataDir, sessionFile: join(dataDir, "session.json"), manifestPath: writeManifest(dir) };
}

async function startShim(layout) {
  const port = await freePort();
  const child = spawn(process.execPath, [SHIM], {
    env: {
      ...process.env,
      ASTRAVIA_SERVICE_PORT: String(port),
      ASTRAVIA_SERVICE_DATA_DIR: layout.dataDir,
      ASTRAVIA_SERVICE_RUNTIME_DIR: layout.runtimeDir,
      ASTRAVIA_SERVICE_SECRET_SESSION_KEY: Buffer.alloc(32, 7).toString("base64url"),
      CANVAS_PAYLOAD_MANIFEST: layout.manifestPath,
      CANVAS_PAYLOAD_BASE_URL: "",
      CANVAS_STABLE_PORTS: "off",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => log.push(chunk));
  child.stderr.on("data", (chunk) => log.push(chunk));

  const base = `http://127.0.0.1:${port}`;
  // 后端没起来时 /mcp 会挂住最多 90 秒，所以先等到 state.ready。
  // 等不到时必须把 shim 自己的日志打出来并收掉子进程：否则失败现场只剩一句「fetch failed」，
  // 而挂着的子进程还会把测试进程的 event loop 留住，让人看到的是超时而不是失败。
  try {
    await waitFor(async () => {
      const res = await fetch(`${base}/__canvas/state`);
      if (!res.ok) return null;
      const state = await res.json();
      return state.ready ? state : null;
    }, "shim ready");
  } catch (error) {
    child.kill("SIGTERM");
    console.error("--- shim log ---");
    console.error(log.join("").slice(-4000));
    throw error;
  }

  return { port, base, child, log };
}

async function stopShim(shim) {
  if (!shim) return;
  shim.child.kill("SIGTERM");
  await new Promise((resolve) => {
    shim.child.once("exit", resolve);
    setTimeout(resolve, 4000);
  });
}

async function rpc(base, payload, { raw = false } = {}) {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? payload : JSON.stringify(payload),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function callTool(base, name, args = {}) {
  const res = await rpc(base, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
  const text = res.json?.result?.content?.[0]?.text ?? "";
  return { ...res, text, isError: Boolean(res.json?.result?.isError) };
}

/** 协议层断言：与会话无关，两个 shim 都能跑，只在第一个上跑一次。 */
async function protocolChecks(base) {
  {
    const res = await rpc(base, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "verify", version: "0" } },
    });
    check("initialize 返回 200", res.status === 200, `status=${res.status}`);
    check("initialize 报出协议版本", typeof res.json?.result?.protocolVersion === "string", String(res.json?.result?.protocolVersion));
    check("initialize 声明 tools 能力", Boolean(res.json?.result?.capabilities?.tools), JSON.stringify(res.json?.result?.capabilities));
    check("serverInfo 名字是 open-ai-canvas", res.json?.result?.serverInfo?.name === "open-ai-canvas", String(res.json?.result?.serverInfo?.name));
    check("initialize 回显请求 id", res.json?.id === 1, JSON.stringify(res.json?.id));
  }

  let tools = [];
  {
    const res = await rpc(base, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    tools = res.json?.result?.tools ?? [];
    check("tools/list 返回工具数组", Array.isArray(tools) && tools.length > 0, `count=${tools.length}`);

    const names = tools.map((tool) => tool.name);
    check("工具名唯一", new Set(names).size === names.length, `${new Set(names).size}/${names.length}`);
    check(
      "每个工具都有非空 description",
      tools.every((tool) => typeof tool.description === "string" && tool.description.trim().length > 0),
      tools.filter((tool) => !tool.description).map((tool) => tool.name).join(","),
    );
    check(
      "每个 inputSchema 都是 object",
      tools.every((tool) => tool.inputSchema?.type === "object"),
      tools.filter((tool) => tool.inputSchema?.type !== "object").map((tool) => tool.name).join(","),
    );
    check(
      "每个 inputSchema 都有 properties",
      tools.every((tool) => tool.inputSchema?.properties && typeof tool.inputSchema.properties === "object"),
      tools.filter((tool) => !tool.inputSchema?.properties).map((tool) => tool.name).join(","),
    );
    // required 里写了但 properties 里没有的键，宿主表单会生不出来。
    const dangling = tools.flatMap((tool) =>
      (tool.inputSchema?.required ?? [])
        .filter((key) => !(key in (tool.inputSchema?.properties ?? {})))
        .map((key) => `${tool.name}.${key}`),
    );
    check("required 的键都在 properties 里", dangling.length === 0, dangling.join(","));

    for (const expected of [
      "list_workspace_projects",
      "get_task",
      "list_node_types",
      "get_node_schema",
      "run_generation",
      "list_skills",
      "get_skill",
      "read_skill_file",
    ]) {
      check(`工具清单包含 ${expected}`, names.includes(expected), `count=${names.length}`);
    }
    check(
      "工具总数符合预期（ADR-0002 十六 + ADR-0007 二 + workspace/task + ADR-0016 技能库八）",
      tools.length === 28,
      `count=${tools.length}`,
    );
  }

  {
    // 分组落错地方不会让任何工具失败——只会在插件视图里静默变成「其他」，或者干脆不显示。
    const listed = await (await fetch(`${base}/__canvas/tools`)).json();
    const groups = new Map((listed.tools ?? []).map((tool) => [tool.name, tool.group]));
    const skillTools = [
      "list_skills",
      "get_skill",
      "list_skill_files",
      "read_skill_file",
      "search_skill_files",
      "list_added_skills",
      "set_skill_added",
      "list_skill_presets",
    ];
    const ungrouped = skillTools.filter((name) => groups.get(name) !== "skills");
    check("技能库工具都登记到 skills 分组", ungrouped.length === 0, ungrouped.join(","));
    const orphaned = [...groups.entries()].filter(([, group]) => !group || group === "other").map(([name]) => name);
    check("没有工具落到 other 分组", orphaned.length === 0, orphaned.join(","));
  }

  {
    // 空参数会失败在「缺 task_id」「缺 canvas_id」这类真实校验上，这是对的；
    // 只有 Unknown tool 说明清单和 dispatch 的 switch 脱节。
    const unhandled = [];
    for (const tool of tools) {
      const res = await callTool(base, tool.name, {});
      if (res.text.startsWith("Unknown tool")) unhandled.push(tool.name);
    }
    check("清单里的每个工具都有 dispatch 分支", unhandled.length === 0, unhandled.join(","));
  }

  {
    const unknownTool = await callTool(base, "no_such_tool");
    check(
      "未知工具返回 Unknown tool 而不是空结果",
      unknownTool.text.startsWith("Unknown tool") && unknownTool.isError === true,
      unknownTool.text.slice(0, 80),
    );

    const unknownMethod = await rpc(base, { jsonrpc: "2.0", id: 3, method: "resources/list" });
    check(
      "未知方法 → -32601 Method not found",
      unknownMethod.json?.error?.code === -32601,
      `code=${unknownMethod.json?.error?.code} status=${unknownMethod.status}`,
    );

    const broken = await rpc(base, "{ not json", { raw: true });
    check("坏 JSON → -32700 Parse error", broken.json?.error?.code === -32700, `code=${broken.json?.error?.code}`);
    check("坏 JSON 的 id 是 null", broken.json?.id === null, JSON.stringify(broken.json?.id));
  }
}

/**
 * 工具返回的 text 可能是 JSON，也可能是错误句子（老 shim 会回 “Unknown tool: x”）。
 * 这里不抛异常：解析失败就回 null，让对应断言变红、其余继续跑——脚本自己要先把
 * 旧实现当成一个可能的输入，而不是一个前提。
 */
function textJson(result) {
  try {
    return JSON.parse(result.text);
  } catch {
    return null;
  }
}

async function main() {
  const layout = buildRuntime();
  let log = [];

  // --- 第一段：没有会话时的拒绝形状 ---
  let shim = await startShim(layout);
  try {
    log = shim.log;
    await protocolChecks(shim.base);

    // ADR-0002 授权节：MCP 工具不能替一个没登录的用户调上游。
    const anonymous = await callTool(shim.base, "list_canvas_projects");
    check(
      "无会话时 MCP 工具拒绝调上游",
      anonymous.isError === true && /session/i.test(anonymous.text),
      anonymous.text.slice(0, 120),
    );

    const anonymousSkills = await callTool(shim.base, "list_skills");
    check(
      "无会话时 list_skills 说清是会话问题而不是没数据",
      anonymousSkills.isError === true && /session/i.test(anonymousSkills.text),
      anonymousSkills.text.slice(0, 120),
    );

    const anonymousNodes = await callTool(shim.base, "list_node_types");
    const anonymousParsed = textJson(anonymousNodes) ?? {};
    check(
      "无会话时 list_node_types 如实报 discovered=false",
      anonymousParsed.discovered === false && anonymousParsed.runtime?.length === 0,
      `discovered=${anonymousParsed.discovered} runtime=${anonymousParsed.runtime?.length}`,
    );
    check("无会话时 list_node_types 仍给出 builtin", Array.isArray(anonymousParsed.builtin) && anonymousParsed.builtin.length > 0, `builtin=${anonymousParsed.builtin?.length}`);
  } finally {
    await stopShim(shim);
  }

  // --- 第二段：升级前的明文会话被就地改写，且解出的 token 真的用了 ---
  writeFileSync(layout.sessionFile, JSON.stringify({ v: 1, token: SESSION_TOKEN }), { mode: 0o600 });
  shim = await startShim(layout);
  try {
    log = shim.log;

    {
      const raw = readFileSync(layout.sessionFile, "utf8");
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      check("session.json 已升级为 v2", parsed?.v === 2 && parsed?.alg === "aes-256-gcm", raw.slice(0, 60));
      check("session.json 里不再出现明文 token", !raw.includes(SESSION_TOKEN), raw.includes(SESSION_TOKEN) ? "token present" : "token absent");
      const mode = statSync(layout.sessionFile).mode & 0o777;
      check("session.json 权限为 0600", mode === 0o600, `mode=${mode.toString(8)}`);
    }

    {
      const listed = await callTool(shim.base, "list_node_types");
      const parsed = textJson(listed) ?? {};
      check("list_node_types 报出 discovered", parsed.discovered === true, String(parsed.discovered));
      check(
        "list_node_types 的 runtime 来自后端 self-report",
        Array.isArray(parsed.runtime) && parsed.runtime.includes("runtime_only_node"),
        JSON.stringify(parsed.runtime),
      );
      const all = Array.isArray(parsed.all) ? parsed.all : [];
      const builtin = Array.isArray(parsed.builtin) ? parsed.builtin : [];
      check(
        "list_node_types 的 all 是并集",
        all.includes("runtime_only_node") && all.length >= builtin.length && builtin.length > 0,
        `all=${all.length} builtin=${builtin.length}`,
      );

      const builtinType = builtin[0];
      const builtinSchema = textJson(await callTool(shim.base, "get_node_schema", { node_type: builtinType })) ?? {};
      check(
        "get_node_schema 对内建类型给出 source=builtin",
        builtinSchema.available === true && builtinSchema.source === "builtin",
        JSON.stringify({ available: builtinSchema.available, source: builtinSchema.source }),
      );

      // 上游只有类型名，没有 per-type schema：诚实回答「存在但拿不到」才是正确落实。
      const runtimeSchema = textJson(await callTool(shim.base, "get_node_schema", { node_type: "runtime_only_node" })) ?? {};
      check(
        "get_node_schema 对运行时类型不编 schema",
        runtimeSchema.available === false && runtimeSchema.registered === true && runtimeSchema.source === "runtime",
        JSON.stringify(runtimeSchema).slice(0, 160),
      );

      const unknownParsed = textJson(await callTool(shim.base, "get_node_schema", { node_type: "definitely_not_a_node" })) ?? {};
      check(
        "get_node_schema 对未知类型报 registered=false",
        unknownParsed.available === false && unknownParsed.registered === false && unknownParsed.source === "none",
        JSON.stringify(unknownParsed).slice(0, 160),
      );
    }

    {
      const projects = await callTool(shim.base, "list_workspace_projects", { page: 2, page_size: 10 });
      const parsed = textJson(projects) ?? {};
      check("list_workspace_projects 走 GET /api/projects", Array.isArray(parsed.projects), projects.text.slice(0, 120));
      // 这条同时证明「加密落盘」不是「加密后自己也读不了」：解出来的 token 真的进了上游请求。
      check(
        "解出的会话被带到上游请求头",
        parsed.sessionCookie === `open_ai_canvas_session=${SESSION_TOKEN}`,
        String(parsed.sessionCookie),
      );

      const task = textJson(await callTool(shim.base, "get_task", { task_id: "task-123" })) ?? {};
      check(
        "get_task 把 task_id 带进 /api/tasks/:id",
        task.task_id === "task-123" && task.status === "completed",
        JSON.stringify(task).slice(0, 120),
      );

      const missing = await callTool(shim.base, "get_task", {});
      check("get_task 缺 task_id 时直接拒绝", missing.isError === true && /task_id/.test(missing.text), missing.text.slice(0, 120));
    }

    // ADR-0016：技能库投影。这一整块只断言「参数真的到了上游」与「返回只带该带的
    // 东西」两件事，不重复断言上游的业务规则。
    {
      const listed = textJson(await callTool(shim.base, "list_skills", { page: 2, page_size: 500, scope: "mine", tag: "drama", sort: "new" })) ?? {};
      const echo = String(listed.skills?.[0]?.name ?? "");
      check("list_skills 走 GET /api/skills", echo.startsWith("/api/skills?"), echo.slice(0, 120));
      check(
        "list_skills 把分页与筛选映射成上游查询串（pageSize 封顶 80）",
        ["page=2", "pageSize=80", "scope=mine", "tag=drama", "sort=new"].every((part) => echo.includes(part)),
        echo,
      );
      check("list_skills 保留分类表", listed.categories?.[0]?.key === "drama", JSON.stringify(listed.categories ?? []).slice(0, 120));
      check(
        "list_skills 只回元数据，不带 instruction",
        Boolean(listed.skills?.[0]) && !("instruction" in listed.skills[0]),
        Object.keys(listed.skills?.[0] ?? {}).join(","),
      );
      check("list_skills 带回分页状态", listed.totalCount === 73 && listed.hasMore === true, JSON.stringify({ total: listed.totalCount, hasMore: listed.hasMore }));

      const detail = textJson(await callTool(shim.base, "get_skill", { skill_id: "yingce-shot-grammar" })) ?? {};
      check(
        "get_skill 取回 SKILL.md 正文",
        typeof detail.instruction === "string" && detail.instruction.startsWith("# yingce-shot-grammar"),
        String(detail.instruction ?? "").slice(0, 40),
      );
      check(
        "get_skill 不截断时如实报长度",
        detail.instructionChars > 400 && detail.instructionTruncated === false,
        JSON.stringify({ chars: detail.instructionChars, truncated: detail.instructionTruncated }),
      );

      const clamped = textJson(await callTool(shim.base, "get_skill", { skill_id: "yingce-shot-grammar", max_chars: 10 })) ?? {};
      check(
        "get_skill 按 max_chars 截断并指向 read_skill_file",
        clamped.instructionTruncated === true && clamped.instruction?.length === 10 && /read_skill_file/.test(clamped.note ?? ""),
        JSON.stringify({ len: clamped.instruction?.length, note: String(clamped.note ?? "").slice(0, 48) }),
      );

      const missingId = await callTool(shim.base, "get_skill", {});
      check("get_skill 缺 skill_id 时直接拒绝", missingId.isError === true && /skill_id/.test(missingId.text), missingId.text.slice(0, 120));

      const gone = await callTool(shim.base, "get_skill", { skill_id: "gone" });
      check("get_skill 把上游 404 转成可读错误", gone.isError === true && /技能不存在/.test(gone.text), gone.text.slice(0, 120));

      const files = textJson(await callTool(shim.base, "list_skill_files", { skill_id: "yingce-shot-grammar" })) ?? {};
      check(
        "list_skill_files 列出包内文件",
        files.files?.length === 2 && files.files[1]?.path === "cards/shot-grammar.md",
        JSON.stringify((files.files ?? []).map((file) => file.path)),
      );

      const file = textJson(await callTool(shim.base, "read_skill_file", { skill_id: "yingce-shot-grammar", path: "cards/shot-grammar.md" })) ?? {};
      check(
        "read_skill_file 把 path 带进上游查询串",
        file.path === "cards/shot-grammar.md" && file.content === "content of cards/shot-grammar.md",
        JSON.stringify(file).slice(0, 160),
      );

      const noPath = await callTool(shim.base, "read_skill_file", { skill_id: "yingce-shot-grammar" });
      check("read_skill_file 缺 path 时直接拒绝", noPath.isError === true && /path/.test(noPath.text), noPath.text.slice(0, 120));

      const found = textJson(await callTool(shim.base, "search_skill_files", { skill_id: "yingce-shot-grammar", query: "轴线" })) ?? {};
      check(
        "search_skill_files 回 path/line/snippet",
        found.results?.[0]?.line === 12 && /轴线/.test(found.results?.[0]?.snippet ?? ""),
        JSON.stringify(found.results ?? []).slice(0, 160),
      );

      const added = textJson(await callTool(shim.base, "list_added_skills")) ?? {};
      check(
        "list_added_skills 走 GET /api/skills/added",
        added.skills?.[0]?.isAdded === true && String(added.skills?.[0]?.name ?? "").includes("/api/skills/added"),
        JSON.stringify(added.skills?.[0] ?? {}).slice(0, 140),
      );

      const removed = textJson(await callTool(shim.base, "set_skill_added", { skill_id: "yingce-shot-grammar", added: false })) ?? {};
      check(
        "set_skill_added false → DELETE /api/skills/:id/add",
        removed.added === false && String(removed.skill?.name ?? "").startsWith("DELETE "),
        JSON.stringify({ added: removed.added, name: removed.skill?.name }),
      );

      const kept = textJson(await callTool(shim.base, "set_skill_added", { skill_id: "yingce-shot-grammar" })) ?? {};
      check(
        "set_skill_added 默认是添加",
        kept.added === true && String(kept.skill?.name ?? "").startsWith("POST "),
        JSON.stringify({ added: kept.added, name: kept.skill?.name }),
      );

      const presets = textJson(await callTool(shim.base, "list_skill_presets")) ?? {};
      check(
        "list_skill_presets 带回场景预设",
        presets.presets?.[0]?.presetId === "product-film" && Array.isArray(presets.presets?.[0]?.skillIds),
        JSON.stringify(presets.presets?.[0] ?? {}).slice(0, 140),
      );
    }

    {
      const state = await (await fetch(`${shim.base}/__canvas/state`)).json();
      check("state 带上游版本", state.canvasVersion === "v0.0.0-verify", String(state.canvasVersion));
      check("state 带载荷版本", state.payloadVersion === "verify-mcp-tools", String(state.payloadVersion));
      check(
        "state 标出会话存在且为加密存储",
        state.session?.present === true && state.session?.storage === "aes-256-gcm",
        JSON.stringify(state.session),
      );
    }
  } finally {
    await stopShim(shim);
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.log("\n--- shim log ---");
    console.log(log.join("").slice(-4000));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
