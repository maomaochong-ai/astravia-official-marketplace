/**
 * The host-node service: MCP tool surface plus the panel's API.
 *
 * One process, one language. The tools hand a driver Strix's sandbox, its skill
 * library, a findings ledger and the working artefacts around it (notes, todos,
 * coverage, threat model). Two drivers exist and they share this registry: the host
 * agent (over MCP) and the plugin's own console, which runs the loop on the host's
 * model and calls the same tools over `/api/tool`.
 *
 * Names, descriptions and schemas come from `agent/strix-tools`: one catalogue, so a
 * tool cannot be described one way to the console's model and another way to MCP.
 *
 * Readiness: /api/health/ready answers 200 as soon as the server listens and puts
 * the detail in the body. The host treats a non-2xx probe as a broken process and
 * restarts it, and a missing Docker daemon is something the user fixes, not a
 * crash loop.
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFile, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { SERVICE_TOOL_NAMES, STRIX_TOOL_SPECS } from "../agent/strix-tools";
import { CoverageStore } from "./coverage";
import { resolveEnvironment } from "./environment";
import { finishGate } from "../domain/scan-mode";
import * as findings from "./findings";
import { NoteStore } from "./notes";
import { containerName, Sandbox, sandboxImage } from "./sandbox";
import { applyPatch, parsePatch } from "./patch";
import { toImagePayload } from "./images";
import { describeScope, outOfScopeHosts, ScopeStore } from "./scope";
import { ShellSessions } from "./shell-sessions";
import { dockerInstallCommand, readPreferences, writePreferences } from "./preferences";
import { locateSkills, loadBodies, loadIndex } from "./skills";
import { installHint, missingTools, probeToolchain } from "./toolchain";
import { managedToolchainDir } from "./paths";
import { describeRoster, mergeRoster, normalizeRoster } from "../domain/mcp-roster";
import { installPaths, type InstallPath } from "../domain/install-paths";
import { createProbeCache } from "./probe-cache";
import { TodoStore } from "./todo";
import { Budget, normalizeLimits } from "./budget";
import { Telemetry } from "./telemetry";
import { listHistory } from "./history";
import { checkFreshness, serviceBuiltAt } from "./freshness";
import { loadLabels, resolveLabel } from "./labels";
import { readRoster } from "./team";
import { packagedPluginRoot } from "./plugin-root";

const PORT = Number(process.env.ASTRAVIA_SERVICE_PORT || 0);
const HOST = process.env.STRIX_BRIDGE_HOST || "127.0.0.1";
const DATA_DIR = process.env.ASTRAVIA_SERVICE_DATA_DIR || "";

/**
 * 服务日志的保留条数。
 *
 * 之前是无限增长：每条工具事件都 push 一次，长跑几小时就是几十万条，而对外只用得到
 * 最后 40 条。这是真实的内存泄漏，不是理论问题。
 */
const LOG_LIMIT = 200;
const log: Record<string, unknown>[] = [];
const subscribers = new Set<(payload: Record<string, unknown>) => void>();

function record(payload: Record<string, unknown>): void {
	log.push(payload);
	// 只保留最近 LOG_LIMIT 条：无限长的日志在长跑里就是内存泄漏。
	if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
	if (log.length > 400) log.shift();
	for (const send of subscribers) send(payload);
}

const sandbox = new Sandbox(record, DATA_DIR);
const notes = new NoteStore(DATA_DIR);
const todos = new TodoStore(DATA_DIR);
const coverage = new CoverageStore(DATA_DIR);
const scope = new ScopeStore(DATA_DIR);
/** Long-running shells the agent chose not to wait for (service/shell-sessions.ts). */
const sessions = new ShellSessions(record);
/** 这一轮的预算：agent 才是花额度的人，所以拒绝发生在服务侧。 */
/** 偏好里的额度：启动时读一次，新沙箱时再读（用户可能刚改过）。 */
let pendingLimits = normalizeLimits({});
const budget = new Budget();
void readPreferences(DATA_DIR)
	.then((preference) => {
		pendingLimits = normalizeLimits(preference.budget ?? {});
		budget.reset(pendingLimits);
	})
	.catch(() => undefined);
/** 本机统计：只写本地文件，从不外发。 */
const telemetry = new Telemetry(DATA_DIR);
void telemetry.serviceStarted();

/**
 * `exec`, plus the two shapes a long command needs.
 *
 * `background: true` hands the command to a kept session and returns immediately; that is
 * how upstream's `exec_command` behaves, and it is the only way to run a full nmap sweep or
 * an interactive tool without losing it to a timeout. Without the flag this is exactly the
 * old blocking call, so nothing that already worked changes.
 *
 * 附带一条范围提示：命令里出现声明范围之外的主机时，结果里会多一个 `outOfScope`
 * 字段并写进轨迹。它不拦命令（拦不住，也不该由正则拦），但让漂移可见。
 */
async function execWithSessions(args: Record<string, unknown>): Promise<Record<string, unknown>> {
	const command = String(args.command ?? "").trim();
	if (!command) throw new Error("command is required");

	const advisory = await scopeAdvisory(command);
	if (args.background === true) {
		if (!sandbox.canHostSession()) throw new Error("no sandbox session; call strix_sandbox_start first");
		const workdir = String(args.workdir ?? "").trim() || undefined;
		const tty = args.tty === true;
		const view = sessions.start({
			command,
			commandDisplay: command,
			argv: sandbox.sessionArgv(command, workdir, tty),
			tty,
			...(sandbox.sessionCwd() ? { cwd: sandbox.sessionCwd() } : {}),
		});
		return { background: true, sessionId: view.id, command, tty, ...advisory };
	}

	const result = await sandbox.exec(args);
	return { ...result, ...advisory };
}

/** Hosts mentioned by a command that the declared scope does not cover. */
/**
 * 越界提示：把命令/参数里出现的主机与已声明范围比一遍。
 *
 * 两条修正（审查 1.0.10）：
 *  - **没声明范围也要说**：之前 `entries.length === 0` 直接返回空——恰恰是"根本没声明"这种
 *    最该提醒的情形最安静；
 *  - 返回值区分「没声明」与「有越界」，面板/agent 能分别处理。
 */
async function scopeAdvisory(command: string): Promise<{ outOfScope?: string[]; scopeUndeclared?: boolean }> {
	const snapshot = await scope.snapshot().catch(() => undefined);
	if (!snapshot) return {};
	if (snapshot.entries.length === 0) {
		// 没声明范围：这是最该提醒的一种情形，而不是最安静的一种。
		return { scopeUndeclared: true };
	}
	const outside = outOfScopeHosts(command, snapshot.entries);
	if (outside.length === 0) return {};
	record({ event: "scope_advisory", hosts: outside, command });
	return { outOfScope: outside };
}

/** `strix_patch`: parse → read → apply → write, in that order, refusing on any doubt. */
async function applyPatchInSandbox(document: string): Promise<Record<string, unknown>> {
	const parsed = parsePatch(document);
	if (parsed.errors.length) return { ok: false, errors: parsed.errors };

	const contents = new Map<string, string | undefined>();
	for (const operation of parsed.operations) {
		if (contents.has(operation.path)) continue;
		const file = await sandbox.readFile(operation.path, 8 * 1024 * 1024).catch(() => ({ exists: false, bytes: new Uint8Array() }));
		contents.set(operation.path, file.exists ? Buffer.from(file.bytes).toString("utf8") : undefined);
	}

	const applied = applyPatch(parsed, (path) => contents.get(path));
	if (applied.errors.length) return { ok: false, errors: applied.errors };

	const written: Array<{ path: string; action: "added" | "updated" | "deleted" }> = [];
	for (const file of applied.files) {
		if (file.content === null) {
			await sandbox.deleteFile(file.path);
			written.push({ path: file.path, action: "deleted" });
			continue;
		}
		const result = await sandbox.writeFile(file.path, file.content);
		if (!result.ok) return { ok: false, errors: [`${file.path}: write failed`], written };
		written.push({ path: file.path, action: contents.get(file.path) === undefined ? "added" : "updated" });
	}

	record({ event: "patch_applied", files: written });
	return { ok: true, written };
}

/** The installer writes `.runtime.json` beside the entry; absent in a source checkout. */
function readVersion(): string {
	try {
		const marker = JSON.parse(readFileSync(new URL("../.runtime.json", import.meta.url), "utf8")) as {
			version?: string;
		};
		return typeof marker.version === "string" ? marker.version : "0.0.0";
	} catch {
		return "0.0.0";
	}
}
const version = readVersion();

/**
 * 三个探测缓存（1.4.1）。
 *
 * 背景：`refresh()` 在每次工具调用结束都会打 `/api/state`，而这个接口原本每次都：
 *   - spawn `docker info` + `docker image inspect`（实测 3.1s）
 *   - 本机模式下 spawn 每个工具的 `--version`（实测 4.6s）
 *   - 顺序读 75 篇技能（实测 0.19s）
 * 于是每调一次工具就有几秒钟花在重复回答同一件事上，还跟真正的扫描抢 CPU。
 *
 * TTL 的选择：环境 8 秒（用户装 docker / 拉镜像之后点「刷新环境」是强制路径，不受它限制），
 * 工具链 60 秒（二进制不会中途冒出来），技能索引 60 秒（随包内容运行期不变）。
 */
const environmentCache = createProbeCache({
	probe: () => resolveEnvironment(sandboxImage()),
	ttlMs: 8_000,
	// daemon 刚起来的情况要尽快反映出来：失败的缓存更短。
	failureTtlMs: 1_500,
	isFailure: (value) => value.ready === false,
});

const toolchainCache = createProbeCache({
	probe: () => probeToolchain(),
	ttlMs: 60_000,
	failureTtlMs: 10_000,
});

const skillsIndexCache = createProbeCache({
	probe: () => loadIndex(locateSkills()),
	ttlMs: 60_000,
});

/**
 * MCP 连接名单。
 *
 * 取它的代价是进容器跑一段 python（docker exec），而面板每次刷新都会取一次。
 * 名单是这一轮连了哪些 server，秒级不会变，所以缓存 10 秒：新连上的 server 在一个呼吸内出现，
 * 又不让每次刷新都多一次容器内进程。
 */
const mcpRosterCache = createProbeCache({
	probe: () => sandbox.mcpRoster(),
	ttlMs: 10_000,
});

async function environment() {
	// 走缓存：它被 `/api/state` 与工具共用，TTL 由 probe-cache 决定。
	const resolved = await environmentCache.get();
	//
	// 缓存里存的是 auto 的结果；用户选了容器就得按容器回答，否则面板拿到 mode=host，
	// 「安装位置」那一块永远不出现（1.5.0 之前的真 bug）。
	const preference = await readPreferences(DATA_DIR);
	const effective =
		preference.environmentMode !== "auto" && preference.environmentMode !== resolved.mode
			? await resolveEnvironment(sandboxImage(), preference.environmentMode)
			: resolved;
	const docker = effective.docker;
	const skills = await locateSkills();
	// Only meaningful in `host` mode: in a container the toolchain is the image's.
	const tools = effective.mode === "host" ? await toolchainCache.get() : [];
	return {
		mode: effective.mode,
		docker: { ready: docker.ready, detail: docker.detail, image: sandboxImage(), imagePresent: docker.imagePresent },
		engine: {
			// "installed" here means the skill library is reachable, which is all the
			// plugin needs now: the container carries the tools.
			installed: Boolean(skills),
			detail: skills ? skills.root : "strix-agent is not installed in any Python on PATH",
		},
		skills: skills ? { root: skills.root, source: skills.source } : null,
		tools,
		missingTools: missingTools(tools).map((name) => ({ name, install: installHint(name) })),
		// Ready means "a scan can start here": with a daemon the container carries the
		// tools; without one the user's session does, so only the skill library has to
		// be there.
		ready: Boolean(skills) && (resolved.mode === "host" || docker.ready),
	};
}

/**
 * 台账的键（1.0.7）。
 *
 * 之前只用 `sandbox.status().sessionId`：一个服务进程只有一个沙箱，于是在 A 会话开了沙箱之后，
 * B 会话里 `strix_file_finding` 会写进 **A 的台账**，B 的面板也从 `/api/state` 读到 A 的容器。
 * 用户看到的“数据串会话”就是这个，不是前端缓存。
 *
 * 现在优先用**面板注册的当前会话**：宿主同一时刻只有一个活动轮次，所以“当前会话”是一个诚实
 * 的归属依据。没有任何会话信息时才退回沙箱 id（命令行的独立跑法就是这样）。
 */
let activeConversation: string | null = null;

function sessionId(): string {
	// 沙箱开着就以**它的主人**为准：评估在跑的时候，操作者可能已经切到另一个会话看，
	// 那不代表这一轮的命令该写进新会话的台账。没有沙箱时才看面板注册的会话。
	const status = sandbox.status();
	return status.conversation ?? activeConversation ?? status.sessionId ?? "default";
}

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * One handler per service tool, keyed by the name in the shared catalogue.
 *
 * Anything the plugin handles itself (`strix_think`, `strix_ask_user`, the agent
 * graph) is absent here on purpose: those need the model or the UI, which the
 * renderer owns.
 */
const HANDLERS: Record<string, Handler> = {
	strix_environment: async () => {
		// 模型主动问“现在的环境”，要的是最新结果，不是缓存。
		environmentCache.invalidate();
		return environment();
	},

	// The MCP roster upstream docks as its own panel. Declared servers come from the
	// manifest, reported ones from the run; the merge keeps both and never invents a
	// "dead" state for a server that simply has not connected yet (domain/mcp-roster.ts).
	strix_mcp: async () => {
		const declared = [{ name: "strix" }];
		// 走缓存：这条路径的代价是一次 docker exec，不该由面板的刷新频率决定。
		const reported = normalizeRoster(await mcpRosterCache.get().catch(() => null));
		const connections = mergeRoster(declared, reported);
		return { connections, summary: describeRoster(connections) };
	},

	strix_sandbox_start: async (args) => {
		// 归属写在**开沙箱的那一刻**：一个进程只有一个沙箱，“这是谁的”不能到读取时再猜。
		// 依据是面板注册的会话：宿主同一时刻只有一个活动轮次。
		const owned: Record<string, unknown> = activeConversation ? { ...args, conversation: activeConversation } : args;
		// 没指定 mode 就用面板选的偏好：面板显示“容器”，这里就必须真的跑在容器里。
		if (owned.environment === undefined) {
			const preference = await readPreferences(DATA_DIR);
			const chosen = preference.environmentMode === "auto" ? undefined : preference.environmentMode;
			// 注意：绝不能把它塞进 `mode`——那是扫描深度。
			if (chosen) return sandbox.start({ ...owned, environment: chosen });
		}
		return sandbox.start(owned);
	},
	// 一条命令的两种形态：等它跑完（默认），或留下一个会话（background）。
	strix_exec: (args) => execWithSessions(args),
	strix_shell_sessions: async (args) => {
		const id = typeof args.sessionId === "string" ? args.sessionId.trim() : "";
		if (id) {
			const one = sessions.find(id);
			if (!one) throw new Error(`no session ${id}`);
			return one;
		}
		return { sessions: sessions.list() };
	},
	strix_write_stdin: async (args) => sessions.write(String(args.sessionId ?? ""), String(args.chars ?? "")),
	strix_kill_session: async (args) => sessions.kill(String(args.sessionId ?? "")),

	// 文件：上游用 SDK 的 patch / view_image，这里用同一份协议对同一个沙箱动手。
	strix_patch: async (args) => {
		const advisory = await scopeAdvisory(String(args.patch ?? ""));
		return { ...(await applyPatchInSandbox(String(args.patch ?? ""))), ...advisory };
	},
	strix_view_image: async (args) => {
		const path = String(args.path ?? "").trim();
		if (!path) throw new Error("path is required");
		const file = await sandbox.readFile(path);
		if (!file.exists) return { ok: false, path, error: "no such file in the sandbox" };
		return toImagePayload(path, file.bytes);
	},

	strix_think: async (args) => {
		const thought = String(args.thought ?? "").trim();
		if (!thought) throw new Error("thought is required");
		// 无副作用：只进日志流，面板的轨迹会把它当一行说明显示。
		record({ event: "think", thought });
		return { ok: true, recorded: thought.length };
	},

	strix_scope: async (args) => {
		const action = typeof args.action === "string" ? args.action : "";
		if (action === "add") return scope.add(args);
		if (action === "remove") return scope.remove(args);
		if (action === "rules") return scope.setRules(args);
		return scope.snapshot();
	},
	strix_sandbox_status: async () => sandbox.status(),
	strix_sandbox_stop: () => sandbox.stop(),
	// 浏览器与代理同样会碰到目标：范围提示不能只挂在 exec 上（审查指出这两条全裸）。
	strix_browser: async (args) => {
		const advisory = await scopeAdvisory(JSON.stringify(args));
		return { ...(await sandbox.browser(args)), ...advisory };
	},
	strix_proxy: async (args) => {
		const advisory = await scopeAdvisory(JSON.stringify(args));
		return { ...(await sandbox.proxy(args)), ...advisory };
	},

	strix_list_skills: async () => {
		// 库已经随包，不再有"上游没装"这种失败——只有包坏了才会空。
		const skills = locateSkills();
		const { entries, categories } = await loadIndex(skills);
		return {
			root: skills.root,
			/** `bundled` = 随包副本；`env` = 运维用 STRIX_SKILLS_DIR 指过去（排查用）。 */
			source: skills.source,
			categories,
			total: entries.length,
			skills: entries.map(({ name, category, description, internal }) => ({ name, category, description, internal })),
		};
	},
	strix_load_skills: async (args) => loadBodies(locateSkills(), (args.names as string[] | undefined) ?? []),

	strix_file_finding: (args) => findings.add(sessionId(), args),
	strix_update_finding: (args) => findings.update(sessionId(), args),
	strix_list_findings: (args) => findings.list(sessionId(), args),
	strix_merge_findings: (args) => findings.merge(sessionId(), args),
	strix_delete_finding: (args) => findings.remove(sessionId(), args),
	strix_report: async (args) => {
		// `deep` promises more than a breadth pass; without a coverage gate the report
		// would read the same as `standard` while the user waited longer.
		// Only the human summary form is gated: the SARIF export is a format, not a close-out.
		if (!args.format) {
			const recorded = await coverage.list(sessionId());
			const gate = finishGate(sandbox.status().scanMode ?? "standard", recorded.entries);
			if (!gate.allowed) return { ok: false, blocked: "coverage", reason: gate.reason };
		}
		// 范围写进报告：读者要能判断证据是否在约定边界内取得（上游 finish_scan 的结构）。
		const snapshot = await scope.snapshot();
		return findings.report(sessionId(), { ...args, scope: describeScope(snapshot) }, { version });
	},

	strix_note_create: (args) => notes.create(sessionId(), args),
	strix_note_list: (args) => notes.list(sessionId(), args),
	strix_note_get: (args) => notes.get(sessionId(), args),
	strix_note_update: (args) => notes.update(sessionId(), args),
	strix_note_delete: (args) => notes.delete(sessionId(), args),

	strix_todo_create: (args) => todos.create(sessionId(), args),
	strix_todo_update: (args) => todos.update(sessionId(), args),
	strix_todo_list: () => todos.list(sessionId()),
	strix_todo_remove: (args) => todos.remove(sessionId(), args),

	strix_coverage_record: (args) => coverage.record(sessionId(), args),
	strix_coverage_list: (args) => coverage.list(sessionId(), args),
	strix_coverage_update: (args) => coverage.update(sessionId(), args),
	strix_threat_model: (args) => coverage.threatModel(sessionId(), args),

	// ---- 会话与状态：预算 / 历史 / 新鲜度 / 花名册 ----------------

	/** 预算：读快照，或改限额（`maxToolCalls` / `maxMinutes` / `maxFindings`， 0 = 不限）。 */
	strix_budget: async (args) => {
		// 传了任一限额就是“改”，因此写入偏好：下一轮与新会话也看得见同一份额度。
		const hasLimit = ["maxToolCalls", "maxMinutes", "maxFindings"].some((key) => args[key] !== undefined);
		if (hasLimit) {
			const limits = normalizeLimits({ ...budget.snapshot().limits, ...args });
			pendingLimits = limits;
			budget.setLimits(limits);
			await writePreferences(DATA_DIR, { budget: limits });
			return { ...budget.snapshot(), preference: await readPreferences(DATA_DIR) };
		}
		return budget.snapshot();
	},

	/** 历史评估：盘上磁盘上留下的评估账（只读、从文件名与内容推导）。 */
	strix_history: async (args) => {
		const limit = Number(args.limit);
		const entries = listHistory(DATA_DIR, Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20);
		return { entries, count: entries.length };
	},

	/** 更新检查：服务产物、技能库、镜像 —— 三件不联网就能判断的新鲜度。 */
	strix_update_check: async () => {
		const root = packagedPluginRoot();
		const report = await checkFreshness({
			pluginRoot: root,
			pluginVersion: version,
			...(sandboxImage() ? { image: sandboxImage() } : {}),
			inspectImage: async (image) => {
				const docker = process.platform === "win32" ? "docker.exe" : "docker";
				const result = await runHost(docker, ["image", "inspect", image, "--format", "{{.Created}}"]);
				return { created: result.code === 0 ? result.stdout.trim() || null : null };
			},
		});
		return { ...report, serviceBuiltAt: serviceBuiltAt(root) };
	},

	/** 团队成员：插件声明的花名册，加上它们署名的发现数（对不上就如实说 0）。 */
	strix_team_roster: async () => {
		const labels = loadLabels(packagedPluginRoot());
		const roster = readRoster(packagedPluginRoot(), {
			findings: await findings.read(sessionId()),
			// 模型只看得到文字，看不到 `%key%`：按提示词语言（中文）在服务侧解一次。
			t: (key) => resolveLabel(labels, `%${key}%`),
		});
		return roster ?? { teamId: "", teamName: "", members: [], filed: {}, totalFiled: 0 };
	},
};

/**
 * 一次工具调用的唯一入口：计价、拦截、统计都在这里。
 *
 * 为什么必须合流：宿主 agent 走的是 MCP 的 `tools/call`，面板走的是 `/api/tool`。
 * 预算只挂在后者上时，真正花额度的那条路完全不计——面板上额度恒为 0，
 * 拒绝永远不会触发。
 */
const METERED = new Set([
	"strix_exec",
	"strix_browser",
	"strix_proxy",
	"strix_patch",
	"strix_file_finding",
]);

/** 查询类不计量：否则"查一下还剩多少额度"本身就会耗尽额度。 */
const FREE = new Set([
	"strix_budget",
	"strix_history",
	"strix_team_roster",
	"strix_update_check",
	"strix_environment",
	"strix_mcp",
	"strix_list_skills",
	"strix_load_skills",
	"strix_sandbox_status",
	"strix_shell_sessions",
	"strix_note_get",
]);

type GateResult = { ok: true; result: unknown } | { ok: false; error: string; budget?: unknown };

async function gateTool(name: string, args: Record<string, unknown>, handler: (a: Record<string, unknown>) => Promise<unknown>): Promise<GateResult> {
	const metered = METERED.has(name) && !FREE.has(name);
	if (metered) {
		const state = budget.snapshot();
		if (state.exhausted.length > 0) {
			return { ok: false, error: `budget exhausted: ${state.reason ?? state.exhausted.join(", ")}`, budget: state };
		}
	}
	try {
		const result = await handler(args);
		// 失败也计数：它同样消耗了这一轮的额度（审查指出异常路径曾全程免费）。
		if (metered) budget.spendToolCall();
		void telemetry.toolCalled(name);
		if (name === "strix_file_finding") {
			budget.spendFinding();
			void telemetry.findingRecorded();
		}
		if (name === "strix_sandbox_start") {
			// 新沙箱 = 新一轮评估：计数归零，额度随偏好重新读一次。
			budget.reset(pendingLimits);
			void telemetry.assessmentStarted();
		}
		return { ok: true, result };
	} catch (error) {
		if (metered) budget.spendToolCall();
		void telemetry.toolCalled(name);
		throw error;
	}
}

/** The catalogue, narrowed to the tools this process answers - specs and handlers agree. */
const TOOLS = STRIX_TOOL_SPECS.filter((spec) => spec.handler === "service").map((spec) => {
	const handler = HANDLERS[spec.name];
	if (!handler) throw new Error(`service tool ${spec.name} has no handler`);
	return { name: spec.name, description: spec.description, inputSchema: spec.parameters, handler };
});

// A spec added without a handler (or the reverse) is a build-time defect, not a
// runtime surprise: fail fast instead of serving a tool that 500s on first call.
const missing = SERVICE_TOOL_NAMES.filter((name) => !TOOLS.some((tool) => tool.name === name));
if (missing.length) throw new Error(`service tools declared but not wired: ${missing.join(", ")}`);


/**
 * 跑一条宿主侧命令（安装 Docker 用）。
 *
 * 不用 shell 拼接：argv 已经是一个完整参数向量，路径与空格不会变成解析问题。
 * 超时给得很长（安装器会下载几百 MB），但一定会结束——不结束的进程比超时更难查。
 */
async function runHost(command: string, argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
	const { execFile } = await import("node:child_process");
	return await new Promise((resolve) => {
		execFile(command, argv, { timeout: 30 * 60_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
			const code = error && typeof (error as { code?: unknown }).code === "number" ? (error as { code: number }).code : error ? 1 : 0;
			resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
		});
	});
}

/** 请求体上限：这个服务只监听 127.0.0.1，但没有上限仍然是一个 OOM 的口子。 */
const MAX_BODY_BYTES = 16 * 1024 * 1024;

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	let bytes = 0;
	for await (const chunk of req) {
		bytes += (chunk as Buffer).length;
		// 超限就不再累积：让这个请求拿到空 body（随后报参数错误），
		// 而不是把整个服务拖进交换分区。
		if (bytes > MAX_BODY_BYTES) break;
		chunks.push(chunk as Buffer);
	}
	if (!chunks.length) return {};
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
	} catch {
		return {};
	}
}

function json(res: ServerResponse, status: number, payload: unknown): void {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(payload));
}

/** An image payload from `strix_view_image`, if that is what the handler returned. */
function asImageContent(
	result: unknown,
): { path: string; base64: string; mimeType: string; bytes: number } | undefined {
	if (!result || typeof result !== "object") return undefined;
	const value = result as Record<string, unknown>;
	if (value.ok !== true) return undefined;
	if (typeof value.dataUri !== "string" || typeof value.base64 !== "string" || typeof value.mimeType !== "string") {
		return undefined;
	}
	return {
		path: typeof value.path === "string" ? value.path : "image",
		base64: value.base64,
		mimeType: value.mimeType,
		bytes: typeof value.bytes === "number" ? value.bytes : 0,
	};
}

async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
	const body = await readBody(req);
	const id = body.id ?? null;
	const reply = (result: unknown) => json(res, 200, { jsonrpc: "2.0", id, result });
	const fail = (code: number, message: string) => json(res, 200, { jsonrpc: "2.0", id, error: { code, message } });

	switch (body.method) {
		case "initialize":
			return reply({
				protocolVersion: "2024-11-05",
				capabilities: { tools: {} },
				serverInfo: { name: "strix", version },
			});
		case "notifications/initialized":
			res.writeHead(202).end();
			return;
		case "tools/list":
			return reply({
				tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
			});
		case "tools/call": {
			const params = (body.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
			const tool = TOOLS.find((item) => item.name === params.name);
			if (!tool) return fail(-32601, `unknown tool: ${params.name}`);
			try {
				const gated = await gateTool(tool.name, params.arguments ?? {}, tool.handler);
				if (!gated.ok) {
					return reply({ isError: true, content: [{ type: "text", text: gated.error }] });
				}
				const result = gated.result;
				// `strix_view_image` 的载荷带着 dataUri：把它换成真正的 image content block，
				// 否则宿主模型只拿到一串 base64 文本，等于白调。其余工具仍是文本。
				const image = asImageContent(result);
				if (image) {
					return reply({
						content: [
							{ type: "image", data: image.base64, mimeType: image.mimeType },
							{ type: "text", text: `image ${image.path} · ${image.mimeType} · ${image.bytes} bytes` },
						],
					});
				}
				return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
			} catch (error) {
				return reply({
					isError: true,
					content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
				});
			}
		}
		default:
			return fail(-32601, `unsupported method: ${String(body.method)}`);
	}
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", `http://${HOST}:${PORT || 80}`);
	try {
		if (url.pathname === "/api/health/ready") {
			return json(res, 200, { ready: true, version });
		}
		if (url.pathname === "/mcp" && req.method === "POST") return await handleMcp(req, res);
		if (url.pathname === "/api/tool" && req.method === "POST") {
			// One HTTP call per tool, through the same handler the MCP surface uses: the
			// console drives the loop, this process owns the container.
			const body = await readBody(req);
			const name = typeof body.name === "string" ? body.name : "";
			const tool = TOOLS.find((item) => item.name === name);
			if (!tool) return json(res, 404, { ok: false, error: `unknown tool: ${name}` });
			const args =
				body.arguments && typeof body.arguments === "object"
					? (body.arguments as Record<string, unknown>)
					: {};
			try {
				const gated = await gateTool(tool.name, args, tool.handler);
				if (!gated.ok) return json(res, 200, { ok: false, error: gated.error, ...(gated.budget ? { budget: gated.budget } : {}) });
				return json(res, 200, { ok: true, result: gated.result });
			} catch (error) {
				// A failed tool is still an answer the loop must see, not a transport error.
				return json(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
			}
		}
		if (url.pathname === "/api/environment") {
			// 环境检测：面板切换环境后要能立刻知道"有没有 docker / 镜像在不在"。
			// 这条请求本身就是"我要最新的"：先失效缓存再取（仍然单飞，不会并发跑十份）。
			const preference = await readPreferences(DATA_DIR);
			environmentCache.invalidate();
			const resolved = await environmentCache.get();
			return json(res, 200, { ...resolved, preference: preference.environmentMode });
		}
		if (url.pathname === "/api/paths") {
			// 「装在哪」：当前系统的 docker 位置、容器内落点、随包工具链与数据目录。
			// 路径是**猜的**（各系统默认值），所以这里逐个探一次"在不在"，面板照实画。
			// 与环境探测同源：走同一个缓存，避免点开一次路径表又多打两次 docker。
			const resolved = await environmentCache.get();
			const status = sandbox.status();
			const container = status.running && status.mode === "docker" && status.sessionId ? containerName(status.sessionId) : null;
			const entries = installPaths({
				platform: process.platform,
				docker: resolved.mode === "docker" && resolved.docker.ready,
				image: sandboxImage(),
				container,
				toolchainDir: managedToolchainDir(),
				dataDir: DATA_DIR,
			}).map((entry: InstallPath): InstallPath => {
				// 容器内路径与其它系统的默认值都不在宿主上，不探。
				if (entry.scope !== "host") return entry;
				const expanded = entry.path.replace(/%([A-Z_]+)%/g, (_match, name: string) => process.env[name] ?? `%${name}%`);
				try {
					return { ...entry, exists: existsSync(expanded) };
				} catch {
					return { ...entry, exists: false };
				}
			});
			return json(res, 200, {
				platform: process.platform,
				mode: resolved.mode,
				image: sandboxImage(),
				container,
				entries,
			});
		}
		if (url.pathname === "/api/environment/pull" && req.method === "POST") {
			// 拉镜像交给宿主执行：docker pull 可能要几分钟、几百 MB，面板只等结果。
			const image = sandboxImage();
			try {
				const docker = process.platform === "win32" ? "docker.exe" : "docker";
				const result = await runHost(docker, ["pull", image]);
				environmentCache.invalidate();
				const resolved = await environmentCache.get();
				return json(res, 200, {
					ok: result.code === 0,
					image,
					tail: (result.code === 0 ? result.stdout : result.stderr).split(/\r?\n/).filter(Boolean).slice(-3),
					environment: resolved,
				});
			} catch (error) {
				return json(res, 200, { ok: false, image, error: String(error) });
			}
		}
		if (url.pathname === "/api/preferences") {
			if (req.method === "POST") {
				const body = (await readBody(req).catch(() => ({}))) as Record<string, unknown>;
				if (body.install === true) {
					// 面板代跑安装命令：记录结果，好在 UI 上说清"刚才那条命令成没成"。
					try {
						const { command, argv } = dockerInstallCommand();
						const result = await runHost(command, argv);
						const ok = result.code === 0;
						const next = await writePreferences(DATA_DIR, {
							lastInstall: { command: `${command} ${argv.join(" ")}`, at: new Date().toISOString(), ok, ...(ok ? {} : { detail: result.stderr.slice(-400) }) },
						});
						return json(res, 200, { ...next, installed: ok });
					} catch (error) {
						return json(res, 200, { ...(await readPreferences(DATA_DIR)), installed: false, error: String(error) });
					}
				}
				const next = await writePreferences(DATA_DIR, { environmentMode: body.environmentMode as never });
				return json(res, 200, next);
			}
			return json(res, 200, await readPreferences(DATA_DIR));
		}
		if (url.pathname === "/api/conversation" && req.method === "POST") {
			// 面板告诉服务“现在活跃的是哪个会话”：台账键与状态归属都靠它（见 sessionId）。
			const body = await readBody(req);
			const id = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
			activeConversation = id || null;
			return json(res, 200, { conversation: activeConversation });
		}
		if (url.pathname === "/api/state") {
			const [env, list, noteList, todoList, cover, threat] = await Promise.all([
				environment().catch((error) => ({ error: String(error) })),
				findings.list(sessionId()).catch(() => ({ count: 0, bySeverity: {}, findings: [] })),
				notes.list(sessionId()).catch(() => ({ count: 0, notes: [] })),
				todos.list(sessionId()).catch(() => ({ count: 0, todos: [] })),
				coverage.list(sessionId()).catch(() => ({ count: 0, byOutcome: {}, entries: [] })),
				coverage.threatModel(sessionId()).catch(() => ({ content: "", targets: [], updated_at: null })),
			]);
			// 会话与状态：预算 / 本机统计 / 历史 / 团队成员四块由同一处给出，
			// 面板不必为它们各发一个请求。
			const [budgetState, telemetryState] = await Promise.all([
				Promise.resolve(budget.snapshot()),
				telemetry.snapshot().catch(() => null),
			]);
			const teamState = readRoster(packagedPluginRoot(), {
				findings: (list as { findings?: Array<{ member?: string }> }).findings ?? [],
			});
			const historyEntries = listHistory(DATA_DIR, 8);
			// 范围条目与能力面：两件都是本地事实，跟上面那批并发取，不另开一次请求。
			const skillLocation = locateSkills();
			const [scopeSnapshot, skillIndex] = await Promise.all([
				scope.snapshot().catch(() => ({ entries: [], rules: { ports: [], notes: [], updatedAt: null } })),
				skillsIndexCache.get().catch(() => undefined),
			]);
			return json(res, 200, {
				environment: env,
				sandbox: sandbox.status(),
				// 台账是按哪个键读的（信息性）：面板的归属判定看 sandbox.conversation，
				// 不看这个字段——它就等于刚注册的那个 id，拿它比自己永远相等（1.0.7 审查）。
				conversationKey: sessionId(),
				findings: (list as { findings?: unknown }).findings ?? [],
				notes: (noteList as { notes?: unknown }).notes ?? [],
				todos: (todoList as { todos?: unknown }).todos ?? [],
				coverage: (cover as { entries?: unknown }).entries ?? [],
				coverageTally: (cover as { byOutcome?: unknown }).byOutcome ?? {},
				threatModel: threat,
				preferences: await readPreferences(DATA_DIR),
				// 工作单元：保留的 shell 会话（上游 agents 面板在本插件的诚实等价物）。
				sessions: sessions.list().map(({ id, command, running, uptimeSec, tty }) => ({ id, command, running, uptimeSec, tty })),
				// 范围是「这次允许触碰什么」的唯一权威；面板需要的是**条目**（能逐行画、
				// 能与对话里的候选去重），不是给报告用的那段文字，所以这里给结构体。
				scope: (() => {
					const snapshot = scopeSnapshot;
					return {
						entries: snapshot.entries.map(({ id, kind, value, note }) => ({ id, kind, value, ...(note ? { note } : {}) })),
						ports: snapshot.rules.ports,
						notes: snapshot.rules.notes,
						text: describeScope(snapshot),
					};
				})(),
				// 配置页要回答“装了什么”：工具面来自随包目录，技能库来自本地文件，
				// 两者都是本地事实，不需要再发一次 MCP 或扫描。
				capabilities: {
					tools: SERVICE_TOOL_NAMES.length,
					skills: skillIndex?.entries.length ?? 0,
					skillCategories: skillIndex?.categories.length ?? 0,
					skillSource: skillLocation.source,
				},
				budget: budgetState,
				telemetry: telemetryState,
				team: teamState,
				history: historyEntries,
				logTail: log.slice(-40),
			});
		}
		if (url.pathname === "/api/report") {
			// ?key= 读历史留档：面板「历史评估」里点一条就预览它的报告。
			const archivedKey = url.searchParams.get("key");
			if (archivedKey) {
				try {
					const archived = readFileSync(join(DATA_DIR, "reports", `${archivedKey.replace(/[^\w.-]/g, "_")}.md`), "utf8");
					return json(res, 200, { markdown: archived, count: 0, key: archivedKey });
				} catch {
					return json(res, 404, { error: "no report for that assessment", key: archivedKey });
				}
			}
			// 之前传 {}：导出的报告没有范围段，等于把“测了什么”丢了一半。
			return json(res, 200, await findings.report(sessionId(), { scope: describeScope(await scope.snapshot()) }, { version }));
		}
		if (url.pathname === "/api/sandbox/stop" && req.method === "POST") {
			mcpRosterCache.invalidate();
			return json(res, 200, await sandbox.stop());
		}
		if (url.pathname === "/api/log") {
			return json(res, 200, { log });
		}
		if (url.pathname === "/api/events") {
			res.writeHead(200, {
				"content-type": "text/event-stream",
				"cache-control": "no-cache",
				connection: "keep-alive",
			});
			const send = (payload: Record<string, unknown>) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
			for (const line of log) send(line);
			subscribers.add(send);
			const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
			req.on("close", () => {
				clearInterval(heartbeat);
				subscribers.delete(send);
			});
			return;
		}
		return json(res, 404, { error: `no route for ${url.pathname}` });
	} catch (error) {
		return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
	}
});

server.listen(PORT, HOST, () => {
	record({ event: "service_listening", host: HOST, port: PORT, id: randomUUID() });
	// 预热：第一次 /api/state 不该等 docker 探测那两秒。失败不要紧——面板会自己再探。
	void environmentCache.get().catch(() => undefined);
});

const shutdown = () => {
	// 先收掉会话：一个被遗留的 nmap 比一个没退干净的进程更难处理。
	void sessions.dispose().finally(() => {
		server.close(() => process.exit(0));
	});
	setTimeout(() => process.exit(0), 2000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
