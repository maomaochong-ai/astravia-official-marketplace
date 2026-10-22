import { definePlugin, readJsonFile, useActivityTab, writeJsonFile } from "@astravia-org/plugin-sdk";
import type { ConversationEvent, ConversationState, PluginContext, PluginStorageApi } from "@astravia-org/plugin-sdk";
import { reportToJson, renderMarkdown } from "./domain/report/report";
import { resolveSamplePath } from "./domain/sample-path";
import { triage } from "./domain/triage";
import type { WorkbenchBridge } from "./features/workbench/bridge";
import { deliverPrompt } from "./features/workbench/services/chat";
import { PanelBoundary } from "./features/workbench/components/shell/panel-boundary";
import { WorkbenchScreen } from "./features/workbench/components/workbench-screen";
import { LIBRARY_STATE_PATH, SETTINGS_STATE_PATH, type ChatState, type LibraryEntry, type WorkbenchSettings } from "./features/workbench/state";
import { getRuntime, setRuntime } from "./runtime-contract";
import { registerTools } from "./tools/register-tools";
import { loadSample } from "./tools/read-sample";
import { isPluginTool } from "./tools/ids";
import type { LabState } from "./domain/lab-mode";
import { LAB_STATE_PATH } from "./features/workbench/hooks/use-lab";
import { registerRuntimeContributions } from "./runtime/contributions";
import "./style.css";

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

	// 权威的「当前有没有活跃会话」：订阅后宿主会立刻 replay 一次 conversation-changed，
	// 比从 sendPrompt 的报错文案里猜可靠。undefined 表示还没收到。
	let activeSession: string | null | undefined;
	try {
		ctx.conversation.on(event => {
			if (event.type === "conversation-changed") activeSession = event.conversation.id;
		});
	} catch {
		// 缺 agent.session.read 时保持未知，chat() 退回「先发再兜底」。
	}

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

		chat: (prompt, cwd) => deliverPrompt(ctx.conversation, prompt, cwd, activeSession),

		subscribeChat: listener => {
			// 真值来自 conversation-changed；turn 事件只在该会话存在时改流式状态。
			let latest: ChatState = { status: "disconnected", tool: null, cwd: null };
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
							push(chatStateOf(event.conversation));
							return;
						case "turn-start":
							settle("streaming", null);
							return;
						case "turn-end":
							settle("idle", null);
							return;
						case "tool-call-start":
							if (!isPluginTool(event.toolName)) return;
							settle("streaming", event.toolName);
							return;
						case "tool-call-end":
							if (!isPluginTool(event.toolName)) return;
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
		settings: () => readJson<WorkbenchSettings>(ctx.storage, SETTINGS_STATE_PATH),
		saveSettings: settings => writeJson(ctx.storage, SETTINGS_STATE_PATH, settings),
		library: () => readJson<LibraryEntry[]>(ctx.storage, LIBRARY_STATE_PATH),
		saveLibrary: entries => writeJson(ctx.storage, LIBRARY_STATE_PATH, entries),
		labMode: () => readJson<LabState>(ctx.storage, LAB_STATE_PATH),
		saveLabMode: state => writeJson(ctx.storage, LAB_STATE_PATH, state),
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
		disposables.push(...registerRuntimeContributions(ctx));

		try {
			ctx.ui.registerActivityTab({
				id: "hanshuang-pojia",
				label: "%tab.label%",
				component: WorkbenchTab,
				scope_use: ["conversation", "project"],
				order: 42,
				initiallyVisible: true,
			});
		} catch (error) {
			console.error("[hanshuang-pojia] activity tab registration failed", error);
		}

		return () => {
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
