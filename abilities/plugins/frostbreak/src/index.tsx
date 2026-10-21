import { definePlugin, readJsonFile, useActivityTab, writeJsonFile } from "@astravia-org/plugin-sdk";
import type { ConversationEvent, ConversationState, PluginContext, PluginStorageApi } from "@astravia-org/plugin-sdk";
import { reportToJson, renderMarkdown } from "./domain/report/report";
import { resolveSamplePath } from "./domain/sample-path";
import { triage } from "./domain/triage";
import type { WorkbenchBridge } from "./features/workbench/bridge";
import { PanelBoundary } from "./features/workbench/components/shell/panel-boundary";
import { WorkbenchScreen } from "./features/workbench/components/workbench-screen";
import { LIBRARY_STATE_PATH, SETTINGS_STATE_PATH, type ChatState, type LibraryEntry, type WorkbenchSettings } from "./features/workbench/state";
import { getRuntime, setRuntime } from "./runtime-contract";
import { registerTools } from "./tools/register-tools";
import { loadSample } from "./tools/read-sample";
import "./style.css";

/** 插件自己的工具 id；宿主可能给它们加前缀，所以用 includes 判定。 */
const TOOL_IDS = [
	"triage_binary",
	"scan_binary_strings",
	"explain_triage_finding",
	"export_triage_report",
	"list_code_symbols",
	"disassemble_range",
	"search_dex_symbols",
	"diff_binaries",
];

function isPluginTool(toolName: string): boolean {
	return TOOL_IDS.some(id => toolName === id || toolName.endsWith(`.${id}`) || toolName.includes(id));
}

function chatStateOf(state: ConversationState): ChatState {
	return {
		status: state.id === null ? "disconnected" : state.isStreaming ? "streaming" : "idle",
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

/** 面板一挂载就会读它，所以 bridge 必须身份稳定（否则目录列表 effect 会反复触发）。 */
const bridges = new WeakMap<PluginContext, WorkbenchBridge>();

function bridgeFor(ctx: PluginContext): WorkbenchBridge {
	const cached = bridges.get(ctx);
	if (cached) return cached;

	const bridge: WorkbenchBridge = {
		listFiles: directory => ctx.fs.readDir(directory),
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
		analyse: (sample, options) => triage(sample, { mode: options.mode, disabledRules: options.disabledRules }),
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

		chat: async (prompt, cwd) => {
			if (!cwd) throw new Error("no workspace folder is attached to this panel");
			// 有活跃会话就直接发；宿主在没有活跃会话时会抛错，这时才新开一个。
			try {
				const result = await ctx.conversation.sendPrompt(prompt);
				if (result.status === "failed") throw new Error(result.error?.message ?? "sendPrompt failed");
				return result.status === "queued" ? "queued" : "sent";
			} catch {
				// fall through: 没有活跃会话
			}
			await ctx.conversation.createSession(cwd, { navigate: true });
			const created = await ctx.conversation.sendPrompt(prompt);
			if (created.status === "failed") throw new Error(created.error?.message ?? "sendPrompt failed");
			return "opened";
		},

		subscribeChat: listener => {
			// tool 是「插件工具正在跑」的瞬时标记，其余状态都从会话快照派生。
			let latest: ChatState = { status: "disconnected", tool: null, cwd: null };
			const push = (next: ChatState) => {
				latest = next;
				listener(next);
			};
			// 订阅要 agent.session.read；授权缺失时宿主抛错，这里退化成「看不到状态」而不是炸掉面板。
			let handle: { dispose(): void };
			try {
				handle = ctx.conversation.on((event: ConversationEvent) => {
					switch (event.type) {
						case "conversation-changed":
							push(chatStateOf(event.conversation));
							return;
						case "turn-start":
							push({ ...latest, status: latest.status === "disconnected" ? "disconnected" : "streaming", tool: null });
							return;
						case "turn-end":
							push({ ...latest, status: latest.status === "disconnected" ? "disconnected" : "idle", tool: null });
							return;
						case "tool-call-start":
							if (!isPluginTool(event.toolName)) return;
							push({ ...latest, status: "streaming", tool: event.toolName });
							return;
						case "tool-call-end":
							if (!isPluginTool(event.toolName)) return;
							push({ ...latest, status: latest.status === "disconnected" ? "disconnected" : "idle", tool: null });
							return;
						default:
							return;
					}
				});
			} catch (error) {
				console.warn("[frostbreak] chat subscription unavailable", error);
				return () => {};
			}
			return () => handle.dispose();
		},

		readState: <T,>(path: string) => readJson<T>(ctx.storage, path),
		writeState: (path, value) => writeJson(ctx.storage, path, value),
		settings: () => readJson<WorkbenchSettings>(ctx.storage, SETTINGS_STATE_PATH),
		saveSettings: settings => writeJson(ctx.storage, SETTINGS_STATE_PATH, settings),
		library: () => readJson<LibraryEntry[]>(ctx.storage, LIBRARY_STATE_PATH),
		saveLibrary: entries => writeJson(ctx.storage, LIBRARY_STATE_PATH, entries),
	};
	bridges.set(ctx, bridge);
	return bridge;
}

/** 活动面板组件：cwd 由宿主 tab 上下文给出，而不是活跃会话。 */
function WorkbenchTab() {
	const { cwd } = useActivityTab();
	const ctx = getRuntime();
	if (!ctx) return null;
	return (
		<PanelBoundary>
			<WorkbenchScreen bridge={bridgeFor(ctx)} cwd={cwd} />
		</PanelBoundary>
	);
}

export default definePlugin({
	activate(ctx) {
		setRuntime(ctx);
		const disposables = registerTools(ctx);

		try {
			ctx.ui.registerActivityTab({
				id: "frostbreak",
				label: "%tab.label%",
				component: WorkbenchTab,
				scope_use: ["conversation", "project"],
				order: 42,
				initiallyVisible: true,
			});
		} catch (error) {
			console.error("[frostbreak] activity tab registration failed", error);
		}

		return () => {
			for (const disposable of disposables) {
				try {
					disposable.dispose();
				} catch (error) {
					console.error("[frostbreak] tool disposal failed", error);
				}
			}
		};
	},
});
