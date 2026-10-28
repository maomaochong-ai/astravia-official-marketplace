/**
 * 技能库代理：把上游 `/api/skills*` 投影成 MCP 工具（ADR-0016）。
 *
 * 上游把 73 个内置技能嵌进二进制，按「技能库」维护——每个技能是一个包（`SKILL.md`
 * 加可选的 `cards/*.md`），库本身提供列表、详情、包内文件、包内全文检索、我的技能
 * 与场景预设。插件这边**不复制**这些文档：复制一份当场就和上游脱节，而且 73 个包
 * 加起来远超插件的更新节奏能维护的范围。这里只做两件事——把智能体的意图翻成上游
 * 请求，把上游响应裁成智能体真正需要的字段。
 *
 * 为什么用注入的 `CanvasApiPort` 而不是直接 import 协议层：模块依赖保持单向
 * （ADR-0012）。传输层（带会话 Cookie 的本地 HTTP）属于协议层，技能库语义属于这里，
 * 两者之间只留一个最小的请求函数接口，本文件因此可以脱离 HTTP 单独推理。
 */
import type { ToolResult } from "./mcp-protocol-server.ts";

export type CanvasApiResult = { status: number; body: any };

/** 传输层端口：协议层把 `rawCanvasApi` 包一层传进来。 */
export type CanvasApiPort = {
  request(method: string, pathname: string, body?: any): Promise<CanvasApiResult>;
};

/** 本模块拥有的工具名。工具目录与协议层 dispatch 都以它为准，避免两处各写一份。 */
export const SKILL_LIBRARY_TOOL_NAMES = [
  "list_skills",
  "get_skill",
  "list_skill_files",
  "read_skill_file",
  "search_skill_files",
  "list_added_skills",
  "set_skill_added",
  "list_skill_presets",
] as const;

export const SKILL_LIBRARY_GROUP = "skills";

/** 上游 `normalizeSkillListRequest` 的上限：pageSize 超过 80 会被压回 80。 */
const MAX_PAGE_SIZE = 80;
/**
 * `get_skill` 默认吐多少字符正文。
 *
 * 最大的内置技能 SKILL.md 约 4.6 万字节，全量塞进一次工具返回会把上下文吃光；卡片
 * 还在包内单独可取。默认值取「够读完一个中位数技能」的量，超出时如实标出被截断，
 * 并指向 `read_skill_file`。
 */
const DEFAULT_INSTRUCTION_CHARS = 20_000;

function isSkillTool(name: string): boolean {
  return (SKILL_LIBRARY_TOOL_NAMES as readonly string[]).includes(name);
}

/** 上游成功响应是 `{code, data, msg}`；失败也是这个形状，`data` 为 null。 */
function unwrap(body: any): any {
  if (body && typeof body === "object" && "data" in body) return body.data;
  return body;
}

/**
 * 把非 2xx 折成一句能给用户看的话。
 *
 * 401 单独处理：它不是「技能不存在」，而是插件还没捕获到登录态——说成后者会让用户
 * 去翻技能列表找一个其实存在的东西。
 */
function failure(result: CanvasApiResult): ToolResult | null {
  const message = typeof result.body?.msg === "string" ? result.body.msg : "";
  if (result.status === 401 || result.body?.code === "canvas-login-required") {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "No canvas session. Open the canvas in a browser and log in first — the plugin captures the session automatically. Skill library data belongs to that account.",
        },
      ],
    };
  }
  if (result.status === 502 || result.body?.code === "canvas-unreachable") {
    return {
      isError: true,
      content: [{ type: "text", text: `Canvas backend is not reachable: ${message || "connection failed"}` }],
    };
  }
  if (result.status >= 400) {
    return {
      isError: true,
      content: [{ type: "text", text: `Canvas rejected the request (HTTP ${result.status}): ${message || "no message"}` }],
    };
  }
  return null;
}

function ok(data: any): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/**
 * 列表项裁剪。
 *
 * 上游 `SkillItem` 有三十来个字段（同步状态、来源 commit、展示媒体、关系表残留……），
 * 对「挑一个技能来用」这件事没帮助，却会把 73 条列表撑成一大坨。保留定位、判断与
 * 计数需要的字段；正文走 `get_skill`，包内文件走 `list_skill_files`。
 */
function projectSkill(item: any) {
  if (!item || typeof item !== "object") return item;
  return {
    skillId: item.skillId,
    name: item.skillName,
    description: item.description,
    tag: item.tag,
    version: item.version,
    versionId: item.versionId,
    fileCount: item.fileCount,
    totalBytes: item.totalBytes,
    likeCount: item.likeCount,
    addedCount: item.addedCount,
    isAdded: item.isAdded,
    isLike: item.isLike,
    isOwner: item.isOwner,
    isPrivate: item.isPrivate,
    markdownUrl: item.markdownUrl,
    libraryCategoryId: item.libraryCategoryId,
  };
}

function positiveInt(value: any, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function requireString(args: any, key: string): string | null {
  const value = args?.[key];
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

/** 技能 ID 是上游的数据库键（目录名只是可读 slug），这里只做 URL 编码，不改写。 */
function skillPath(skillId: string, suffix = ""): string {
  return `/api/skills/${encodeURIComponent(skillId)}${suffix}`;
}

async function listSkills(port: CanvasApiPort, args: any): Promise<ToolResult> {
  const params = new URLSearchParams();
  params.set("page", String(positiveInt(args.page, 1)));
  params.set("pageSize", String(Math.min(positiveInt(args.page_size, 20), MAX_PAGE_SIZE)));
  if (typeof args.scope === "string" && args.scope) params.set("scope", args.scope);
  if (typeof args.sort === "string" && args.sort) params.set("sort", args.sort);
  if (typeof args.tag === "string" && args.tag) params.set("tag", args.tag);
  if (typeof args.search === "string" && args.search.trim()) params.set("search", args.search.trim());

  const result = await port.request("GET", `/api/skills?${params.toString()}`);
  const failed = failure(result);
  if (failed) return failed;

  const data = unwrap(result.body) ?? {};
  const skills = Array.isArray(data.skills) ? data.skills.map(projectSkill) : [];
  return ok({
    skills,
    totalCount: data.totalCount,
    hasMore: data.hasMore,
    nextOffset: data.nextOffset,
    page: data.page,
    pageSize: data.pageSize,
    categories: data.categories,
    note:
      "List items carry metadata only. Call get_skill for the SKILL.md body, list_skill_files for the cards, " +
      "and search_skill_files to look inside one package. An unknown tag is silently cleared by the canvas, " +
      "so an empty result with an unusual tag means the filter was dropped.",
  });
}

async function getSkill(port: CanvasApiPort, args: any): Promise<ToolResult> {
  const skillId = requireString(args, "skill_id");
  if (!skillId) {
    return { isError: true, content: [{ type: "text", text: "skill_id is required (take it from list_skills; it is not the readable folder name)." }] };
  }
  const result = await port.request("GET", skillPath(skillId));
  const failed = failure(result);
  if (failed) return failed;

  const data = unwrap(result.body);
  if (!data || typeof data !== "object") {
    return { isError: true, content: [{ type: "text", text: `Skill ${skillId} came back empty.` }] };
  }

  const instruction = typeof data.instruction === "string" ? data.instruction : "";
  const maxChars = Number.isFinite(Number(args.max_chars)) && Number(args.max_chars) >= 0
    ? Math.floor(Number(args.max_chars))
    : DEFAULT_INSTRUCTION_CHARS;
  const truncated = maxChars > 0 && instruction.length > maxChars;

  return ok({
    skillId: data.skillId,
    name: data.skillName,
    description: data.description,
    tag: data.tag,
    version: data.version,
    fileCount: data.fileCount,
    totalBytes: data.totalBytes,
    isAdded: data.isAdded,
    isLike: data.isLike,
    likeCount: data.likeCount,
    addedCount: data.addedCount,
    instruction: truncated ? instruction.slice(0, maxChars) : instruction,
    instructionChars: instruction.length,
    instructionTruncated: truncated,
    ...(truncated
      ? {
          note:
            `Instruction truncated at ${maxChars} of ${instruction.length} characters. ` +
            "Call read_skill_file with path \"SKILL.md\" for the rest, and list_skill_files to see the cards.",
        }
      : {}),
  });
}

async function listSkillFiles(port: CanvasApiPort, args: any): Promise<ToolResult> {
  const skillId = requireString(args, "skill_id");
  if (!skillId) return { isError: true, content: [{ type: "text", text: "skill_id is required." }] };

  const result = await port.request("GET", skillPath(skillId, "/files"));
  const failed = failure(result);
  if (failed) return failed;

  const data = unwrap(result.body) ?? {};
  const files = Array.isArray(data.files) ? data.files : [];
  return ok({
    skillId,
    files,
    note: "Paths are package-relative; pass them verbatim to read_skill_file. SKILL.md is the entry point, cards/*.md are the reference cards.",
  });
}

async function readSkillFile(port: CanvasApiPort, args: any): Promise<ToolResult> {
  const skillId = requireString(args, "skill_id");
  const filePath = requireString(args, "path");
  if (!skillId) return { isError: true, content: [{ type: "text", text: "skill_id is required." }] };
  if (!filePath) {
    return { isError: true, content: [{ type: "text", text: "path is required (package-relative, e.g. SKILL.md or cards/shot-grammar.md)." }] };
  }

  const result = await port.request("GET", skillPath(skillId, `/file?path=${encodeURIComponent(filePath)}`));
  const failed = failure(result);
  if (failed) return failed;

  const data = unwrap(result.body) ?? {};
  const file = data.file ?? {};
  // 上游对二进制文件只回元信息与 binary=true；如实转述，不要假装拿到了正文。
  if (file.binary) {
    return ok({
      skillId,
      path: file.file?.path ?? filePath,
      binary: true,
      file: file.file,
      note: "This file is binary; the canvas returns metadata only. Skills are Markdown, so this is usually an asset.",
    });
  }
  return ok({
    skillId,
    path: file.file?.path ?? filePath,
    mimeType: file.file?.mimeType,
    size: file.file?.size,
    content: file.content ?? "",
  });
}

async function searchSkillFiles(port: CanvasApiPort, args: any): Promise<ToolResult> {
  const skillId = requireString(args, "skill_id");
  const query = requireString(args, "query");
  if (!skillId) return { isError: true, content: [{ type: "text", text: "skill_id is required." }] };
  if (!query) {
    return { isError: true, content: [{ type: "text", text: "query is required (1-120 characters; the canvas rejects anything else)." }] };
  }

  const result = await port.request("GET", skillPath(skillId, `/search?q=${encodeURIComponent(query)}`));
  const failed = failure(result);
  if (failed) return failed;

  const data = unwrap(result.body) ?? {};
  const results = Array.isArray(data.results) ? data.results : [];
  return ok({
    skillId,
    query,
    results,
    note: "Each hit is path + line + snippet. Read the whole file with read_skill_file when the snippet is not enough.",
  });
}

async function listAddedSkills(port: CanvasApiPort): Promise<ToolResult> {
  const result = await port.request("GET", "/api/skills/added");
  const failed = failure(result);
  if (failed) return failed;

  const data = unwrap(result.body) ?? {};
  const skills = Array.isArray(data.skills) ? data.skills.map(projectSkill) : [];
  return ok({
    skills,
    note: "These are the skills this account has added to its library — the ones the canvas offers during a task.",
  });
}

async function setSkillAdded(port: CanvasApiPort, args: any): Promise<ToolResult> {
  const skillId = requireString(args, "skill_id");
  if (!skillId) return { isError: true, content: [{ type: "text", text: "skill_id is required." }] };
  const added = args.added === undefined ? true : Boolean(args.added);

  const result = await port.request(added ? "POST" : "DELETE", skillPath(skillId, "/add"));
  const failed = failure(result);
  if (failed) return failed;
  return ok({ skillId, added, skill: projectSkill(unwrap(result.body)) });
}

async function listSkillPresets(port: CanvasApiPort): Promise<ToolResult> {
  const result = await port.request("GET", "/api/skills/presets");
  const failed = failure(result);
  if (failed) return failed;

  const data = unwrap(result.body) ?? {};
  const presets = Array.isArray(data.presets) ? data.presets : [];
  return ok({
    presets,
    note:
      "A preset maps a plain-language scene to a set of skillIds with a rationale. It is read-only catalogue " +
      "metadata and needs no login, but the skills it names still do.",
  });
}

/**
 * 技能库工具的唯一入口。协议层只负责「这个名字归我」并转进来，语义全在这里。
 */
export async function callSkillTool(name: string, args: any, port: CanvasApiPort): Promise<ToolResult> {
  if (!isSkillTool(name)) {
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
  switch (name) {
    case "list_skills":
      return listSkills(port, args);
    case "get_skill":
      return getSkill(port, args);
    case "list_skill_files":
      return listSkillFiles(port, args);
    case "read_skill_file":
      return readSkillFile(port, args);
    case "search_skill_files":
      return searchSkillFiles(port, args);
    case "list_added_skills":
      return listAddedSkills(port);
    case "set_skill_added":
      return setSkillAdded(port, args);
    case "list_skill_presets":
      return listSkillPresets(port);
    default:
      return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
}
