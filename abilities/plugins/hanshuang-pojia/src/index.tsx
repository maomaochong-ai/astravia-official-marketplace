import { definePlugin, readJsonFile, useActivityTab, writeJsonFile } from "@astravia-org/plugin-sdk";
import type { ConversationEvent, ConversationState, PluginContext, PluginStorageApi } from "@astravia-org/plugin-sdk";
import { reportToJson, renderMarkdown } from "./domain/report/report";
import { resolveSamplePath } from "./domain/sample-path";
import { triage } from "./domain/triage";
import type { WorkbenchBridge } from "./features/workbench/bridge";
import { deliverPrompt } from "./features/workbench/services/chat";
import { IMPORT_DIRECTORY, importRelativePath } from "./features/workbench/services/import-file";
import { PanelBoundary } from "./features/workbench/components/shell/panel-boundary";
import { WorkbenchScreen } from "./features/workbench/components/workbench-screen";
import { sanitizeCases } from "./domain/my-cases";
import { storageEntry } from "./domain/storage-layout";
import { type ChatState, type LibraryEntry, type WorkbenchSettings } from "./features/workbench/state";
import { getRuntime, setRuntime } from "./runtime-contract";
import { registerTools } from "./tools/register-tools";
import { loadSample } from "./tools/lib/read-sample";
import { isPluginTool } from "./tools/ids";
import { publishTaskEvent } from "./runtime/panel-channel";
import type { LabState } from "./domain/lab-mode";
import type { ProbeRecord } from "./domain/refusal-probe";
import { LAB_STATE_PATH } from "./features/workbench/hooks/use-lab";
import { cacheLabState, registerRuntimeContributions } from "./runtime/contributions";
import "./style.css";

function chatStateOf(state: ConversationState): ChatState {
	return {
		status: state.id === null ? "disconnected" : state.isStreaming ? "streaming" : "idle",
		sessionId: state.id,
		tool: null,
		cwd: state.cwd,
	};
}

/** 存储读写一律容错：没有 storage 授权时面板退化成会话内状态，不报错。 */
async function readJson<T>(storage: PluginStorageApi, path: string): Promise<T | null> {
	try {
		return await readJsonFile<T>(storage, path);
	} catch {
		return null;
	}
}

async function writeJson(storage: PluginStorageApi, path: string, value: unknown): Promise<boolean> {
	try {
		await writeJsonFile(storage, path, value);
		return true;
	} catch {
		return false;
	}
}

/**
 * 面板一挂载就会读它，所以 bridge 必须身份稳定（否则目录列表 effect 会反复触发）。
 *
 * 但 ctx 一旦被宿主换掉就必须重建：重建时**先释放上一条 conversation 订阅**，
 * 否则每多一次重建就多一个永不 dispose 的监听器，它们会继续往面板投事件。
 */
let bridgeCache: { ctx: PluginContext; bridge: WorkbenchBridge } | null = null;
let detachBridge: (() => void) | null = null;

/** activate 时调用：让下一个 bridgeFor 用新的 ctx 重建并释放旧订阅。 */
export function resetBridge(): void {
	bridgeCache = null;
	if (detachBridge) {
		try {
			detachBridge();
		} catch (error) {
			console.warn("[hanshuang-pojia] bridge detach failed", error);
		}
		detachBridge = null;
	}
}

/** 正在分块导入的文件：键是 `cwd\0文件名`，值是已收到的 base64 段。 */
const pendingImports = new Map<string, string[]>();

function bridgeFor(ctx: PluginContext): WorkbenchBridge {
	const cached = bridgeCache;
	if (cached && cached.ctx === ctx) return cached.bridge;
	if (cached) resetBridge();

	// 权威的「当前有没有活跃会话」：订阅后宿主会立刻 replay 一次 conversation-changed，
	// 比从 sendPrompt 的报错文案里猜可靠。undefined 表示还没收到。
	let activeSession: string | null | undefined;
	// 宿主在 conversation-changed 里带 cwd；记下来给 listReports 当根，不要另外去猜。
	let activeCwd: string | null = null;
	try {
		const handle = ctx.conversation.on(event => {
			if (event.type === "conversation-changed") activeSession = event.conversation.id;
		});
		detachBridge = () => handle.dispose();
	} catch {
		// 缺 agent.session.read 时保持未知，chat() 退回「先发再兜底」。
	}

	const bridge: WorkbenchBridge = {
		listFiles: directory => ctx.fs.readDir(directory),
		readTextFile: async path => {
			try {
				const file = await ctx.fs.readFile(path);
				// 非 UTF-8 编码拿到的是 base64 片段，对 Markdown 解析没有意义，按「读不到」处理。
				return file.encoding === "utf8" ? file.content : null;
			} catch {
				// 越界、超限、不存在在战例页是同一个意思：这篇文档没有内容可展示。
				return null;
			}
		},
		stat: async (path, cwd) => {
			try {
				const entry = await ctx.fs.stat(resolveSamplePath(cwd ?? "", path));
				return entry ? { size: entry.size } : null;
			} catch {
				// 越界或不存在都交给 loadSample 给出可读的解释。
				return null;
			}
		},
		loadSample: (path, cwd) => loadSample(ctx.fs, cwd ?? "", path),
		importSample: async (file, cwd) => {
			if (!cwd) throw new Error("No workspace folder is attached to this panel.");
			// resolveSamplePath 负责分隔符与 `..`；文件名已由 importName 压成纯文件名。
			const directory = resolveSamplePath(cwd, IMPORT_DIRECTORY);
			const target = resolveSamplePath(cwd, importRelativePath(file.name));
			const index = file.index ?? 0;
			// ctx.fs.writeFile 只有覆盖写，没有 append：分块只能在这里攒起来，最后一次性落盘。
			// 攒的是 base64 文本，峰值约 1.33× 文件大小，换来的是单次 IPC 体积受控。
			const key = `${cwd}\u0000${file.name}`;
			const parts = index === 0 ? [] : pendingImports.get(key) ?? [];
			parts.push(file.base64);
			if (file.last === false) {
				pendingImports.set(key, parts);
				return target;
			}
			pendingImports.delete(key);
			await ctx.fs.createDirectory(directory);
			await ctx.fs.writeFile(target, index === 0 ? file.base64 : parts.join(""), "base64");
			return target;
		},
		analyse: (sample, options) => triage(sample, { mode: options.mode, disabledRules: options.disabledRules }),
		// 脚本落到工作区而不是主目录：宿主只放行项目内写盘，而用户执行前正好可以先看一遍。
		saveInjectScript: async (name, content) => {
			const safe = name.replace(/[^a-zA-Z0-9._-]/g, "-");
			const target = `.hanshuang/inject/${safe}`;
			try {
				await ctx.fs.writeFile(target, content, "utf8");
				return target;
			} catch {
				return null;
			}
		},
		// 只在工作区的 reports/ 下找：那是唯一被授权的写盘目录。
		// reports/ 是平铺目录，readDir 一层就够；不递归，也不去猜别的位置。
		listReports: async () => {
			// 面板的 cwd 由会话状态给出（host 在 conversation 事件里推）；没有工作区就没有报告。
			const cwd = activeCwd;
			if (!cwd) return [];
			let entries;
			try {
				entries = await ctx.fs.readDir(`${cwd}/reports`);
			} catch {
				// 目录还不存在：没有报告不是错误。
				return [];
			}
			const reports = [];
			for (const entry of entries) {
				if (entry.isDirectory || !/\.(md|json)$/i.test(entry.name)) continue;
				reports.push({ path: entry.path, name: entry.name, bytes: entry.size ?? 0 });
			}
			return reports;
		},
		readReport: async path => {
			try {
				const file = await ctx.fs.readFile(path);
				return file.encoding === "utf8" ? file.content : null;
			} catch {
				return null;
			}
		},
		saveReport: async (report, mode, format) => {
			const stem = report.target.name.replace(/\.[^.]+$/, "") || "sample";
			const isJson = format === "json";
			return ctx.fs.saveAs(
				`${stem}-triage.${isJson ? "json" : "md"}`,
				isJson ? reportToJson(report) : renderMarkdown(report, { mode }),
				"utf8",
				{
					title: `Save triage report for ${report.target.name}`,
					filters: [isJson ? { name: "JSON", extensions: ["json"] } : { name: "Markdown", extensions: ["md"] }],
				},
			);
		},
		notify: (message, variant) => ctx.ui.notify({ message, variant, title: "Hanshuang Pojia" }),

		chat: (prompt, cwd) => deliverPrompt(ctx.conversation, prompt, cwd, activeSession),

		subscribeChat: listener => {
			// 真值来自 conversation-changed；turn 事件只在该会话存在时改流式状态。
			let latest: ChatState = { status: "disconnected", sessionId: null, tool: null, cwd: null };
			let hasSession = false;
			const push = (next: ChatState) => {
				latest = next;
				listener(next);
			};
			const settle = (status: ChatState["status"], tool: string | null) => {
				push({ ...latest, status: hasSession ? status : "disconnected", tool });
			};
			// 订阅要 agent.session.read；授权缺失时宿主抛错，这里退化成「看不到状态」而不是炸掉面板。
			let handle: { dispose(): void };
			try {
				handle = ctx.conversation.on((event: ConversationEvent) => {
					switch (event.type) {
						case "conversation-changed":
							hasSession = event.conversation.id !== null;
							activeSession = event.conversation.id;
							activeCwd = event.conversation.cwd;
							publishTaskEvent({ phase: "conversation", sessionId: event.conversation.id, streaming: event.conversation.isStreaming, cwd: event.conversation.cwd });
							push(chatStateOf(event.conversation));
							return;
						case "turn-start":
							publishTaskEvent({ phase: "turn-start", sessionId: activeSession ?? null, streaming: true });
							settle("streaming", null);
							return;
						case "turn-end":
							publishTaskEvent({ phase: "turn-end", sessionId: activeSession ?? null, streaming: false });
							settle("idle", null);
							return;
						case "tool-call-start":
							if (!isPluginTool(event.toolName)) return;
							publishTaskEvent({ phase: "tool-start", sessionId: activeSession ?? null, toolName: event.toolName, streaming: true });
							settle("streaming", event.toolName);
							return;
						case "tool-call-end":
							if (!isPluginTool(event.toolName)) return;
							publishTaskEvent({ phase: "tool-end", sessionId: activeSession ?? null, toolName: event.toolName, isError: event.isError, streaming: false });
							settle("idle", null);
							return;
						default:
							return;
					}
				});
			} catch (error) {
				console.warn("[hanshuang-pojia] chat subscription unavailable", error);
				return () => {};
			}
			return () => handle.dispose();
		},

		readState: <T,>(path: string) => readJson<T>(ctx.storage, path),
		writeState: (path, value) => writeJson(ctx.storage, path, value),
		// 设置页要把「插件到底写了什么」列全：list 读的是真实存在的文件，不是我们以为的路径。
		listState: async prefix => {
			try {
				return await ctx.storage.list(prefix);
			} catch {
				return [];
			}
		},
		// 真实占用：只认 list 返回的路径，再用一次快照把字节数读出来。
		// 上限 200 个文件：插件的私有存储本来就只有几十份 JSON，超过说明前缀传错了。
		stateUsage: async prefix => {
			try {
				const paths = (await ctx.storage.list(prefix)).slice(0, 200);
				// 空目录是「真的空」，不是「读不到」：两者在设置页上文案不同。
				if (paths.length === 0) return { files: 0, bytes: 0 };
				const snapshot = await ctx.storage.readSnapshot(paths, "utf8");
				let bytes = 0;
				for (const content of Object.values(snapshot.files)) {
					if (typeof content === "string") bytes += content.length;
				}
				return { files: paths.length, bytes };
			} catch {
				return null;
			}
		},
		removeState: async paths => {
			try {
				await ctx.storage.commit(paths.map(path => ({ type: "remove" as const, path })));
				return true;
			} catch {
				return false;
			}
		},
		settings: () => readJson<WorkbenchSettings>(ctx.storage, storageEntry("settings", null).path),
		saveSettings: settings => writeJson(ctx.storage, storageEntry("settings", null).path, settings),
		// 报告按**会话**分文件（ADR 0023）：换会话再看到上一段的报告就是串会话。
		// 旧的扁平路径不回落 —— 它没有会话身份，读它等于把 A 会话的结果端给 B。
		library: (cwd, sessionId) => readJson<LibraryEntry[]>(ctx.storage, storageEntry("library", cwd, sessionId).path),
		saveLibrary: (entries, cwd, sessionId) =>
			writeJson(ctx.storage, storageEntry("library", cwd, sessionId).path, entries),
		myCases: async cwd => {
			const entry = storageEntry("cases", cwd);
			const scoped = await readJson<unknown>(ctx.storage, entry.path);
			if (scoped) return sanitizeCases(scoped);
			const legacy = entry.legacyPath ? await readJson<unknown>(ctx.storage, entry.legacyPath) : null;
			return legacy ? sanitizeCases(legacy) : null;
		},
		saveMyCases: (cases, cwd) => writeJson(ctx.storage, storageEntry("cases", cwd).path, cases),
		labMode: () => readJson<LabState>(ctx.storage, LAB_STATE_PATH),
		// 探测记录与宿主模型快照都是「这次对话测的是谁」，按会话分文件。
		probeRecord: sessionId => readJson<ProbeRecord>(ctx.storage, storageEntry("probeRecord", null, sessionId).path),
		hostModel: async sessionId => {
			try {
				const entry = storageEntry("hostModel", null, sessionId);
				const raw = await ctx.storage.readFile(entry.path, "utf8");
				return raw ? (JSON.parse(raw) as never) : null;
			} catch {
				return null;
			}
		},
		saveLabMode: state => {
			// 面板开关是写穿路径：缓存先更新，否则下一条消息仍按旧值注入。
			cacheLabState(ctx, state);
			return writeJson(ctx.storage, LAB_STATE_PATH, state);
		},
	};
	bridgeCache = { ctx, bridge };
	return bridge;
}

/** 活动面板组件：cwd 由宿主 tab 上下文给出，而不是活跃会话。 */
function WorkbenchTab() {
	const { cwd, active } = useActivityTab();
	const ctx = getRuntime();
	if (!ctx) return null;
	return (
		<PanelBoundary>
			<WorkbenchScreen bridge={bridgeFor(ctx)} cwd={cwd} active={active} />
		</PanelBoundary>
	);
}

/** tab id：注册、显式 attach、从输入框开关跳转都用同一个常量。 */
const TAB_ID = "hanshuang-pojia";

/**
 * 可见范围。`scope_use` 是 fail-closed：没列出的场景里 tab 会被直接过滤掉，
 * 所以 CLI / IM 会话也要写进来（只写 conversation/project 时，那些会话里看不到它）。
 */
const SCOPES = ["conversation", "project", "im-claw", "cli"] as const;

export default definePlugin({
	activate(ctx) {
		setRuntime(ctx);
		// 新 ctx 意味着上一条既有订阅已经失效：先释放，避免监听器越积越多。
		resetBridge();

		const disposables: { dispose(): void }[] = [];

		/**
		 * 注册顺序是正确性问题，不是风格问题。
		 *
		 * tab 是这个插件全部的可见存在。它以前排在 registerTools / registerRuntimeContributions
		 * 之后，而那两个都碰宿主 bridge：bridge 没就绪就抛，activate 直接中断，
		 * 用户看到的是「装好了，但 + 列表里没有它」。而现在：
		 *
		 *   1. tab 第一，独占一个 guard；
		 *   2. 后续每步各自 guard，一步失败不回收前面已注册的东西；
		 *   3. 注册后再显式 setActivityTabVisible(true)：用户点过减号会留下 detach 记录，
		 *      而显式记录优先于 initiallyVisible，不主动 attach 就永久消失；
		 *   4. scope_use 是 fail-closed，只写 conversation/project 会让 CLI / IM 会话看不到它。
		 */
		try {
			disposables.push(
				ctx.ui.registerActivityTab({
					id: TAB_ID,
					label: "%tab.label%",
					component: WorkbenchTab,
					scope_use: SCOPES,
					order: 42,
					// 不默认常驻：宿主每开一个会话都会把默认可见的标签挂上去，
					// 十几次会话就是十几次静默启动。入口仍在三处：+ 列表、输入框开关、工具调用。
					initiallyVisible: false,
				}),
			);
			// 清掉历史 detach 记录，让 + 列表里一定能看到它。
			ctx.ui.setActivityTabVisible(TAB_ID, true);
			console.log("[hanshuang-pojia] activity tab registered");
		} catch (error) {
			// 唯一不能静默失败的一步：tab 没注册，插件就等于没装。
			console.error("[hanshuang-pojia] activity tab registration failed", error);
		}

		try {
			disposables.push(...registerTools(ctx));
		} catch (error) {
			console.error("[hanshuang-pojia] tool registration failed", error);
		}

		try {
			disposables.push(...registerRuntimeContributions(ctx));
		} catch (error) {
			console.error("[hanshuang-pojia] runtime contributions failed", error);
		}

		// 输入框开关：行内条目 + 激活后的胶囊。职责只有一个——把工作台标签叫到前台；
		// 关掉开关只是收回入口，不卸载工具。
		try {
			disposables.push(
				ctx.ui.registerInputAction({
					id: "hanshuang-pojia:workbench",
					label: "%action.workbench%",
					defaultActive: false,
					scope_use: SCOPES,
					onToggle(active) {
						if (active !== true) return;
						try {
							ctx.ui.openActivityTab(TAB_ID);
						} catch (error) {
							console.error("[hanshuang-pojia] open tab from composer failed", error);
						}
					},
				}),
			);
		} catch (error) {
			console.error("[hanshuang-pojia] input action registration failed", error);
		}

		return () => {
			resetBridge();
			for (const disposable of disposables) {
				try {
					disposable.dispose();
				} catch (error) {
					console.error("[hanshuang-pojia] tool disposal failed", error);
				}
			}
		};
	},
});
