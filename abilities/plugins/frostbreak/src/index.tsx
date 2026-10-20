import { definePlugin, useActivityTab } from "@astravia-org/plugin-sdk";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { reportToJson, renderMarkdown } from "./domain/report/report";
import { resolveSamplePath } from "./domain/sample-path";
import { triage } from "./domain/triage";
import type { TriageBridge } from "./features/triage-workbench/bridge";
import { TriageWorkbench } from "./features/triage-workbench/components/triage-workbench";
import { getRuntime, setRuntime } from "./runtime-contract";
import { loadSample } from "./tools/read-sample";
import { registerTools } from "./tools/register-tools";
import "./style.css";

/** 面板一挂载就会读它，所以 bridge 必须身份稳定（否则目录列表 effect 会反复触发）。 */
const bridges = new WeakMap<PluginContext, TriageBridge>();

function bridgeFor(ctx: PluginContext): TriageBridge {
	const cached = bridges.get(ctx);
	if (cached) return cached;
	const bridge: TriageBridge = {
		listFiles: directory => ctx.fs.readDir(directory),
		stat: async (path, cwd) => {
			try {
				const absolute = resolveSamplePath(cwd ?? "", path);
				const entry = await ctx.fs.stat(absolute);
				return entry ? { size: entry.size } : null;
			} catch {
				// 越界或不存在都交给 loadSample 给出可读的解释。
				return null;
			}
		},
		loadSample: (path, cwd) => loadSample(ctx.fs, cwd ?? "", path),
		analyse: (sample, mode) => triage(sample, { mode }),
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
		handOff: async (prompt, cwd) => {
			if (!cwd) throw new Error("no workspace folder is attached to this panel");
			// 有活跃会话就直接发；宿主在没有活跃会话时会抛错，这时才新开一个。
			try {
				const result = await ctx.conversation.sendPrompt(prompt);
				if (result.status !== "failed") return "sent";
			} catch {
				// fall through: 没有活跃会话
			}
			await ctx.conversation.createSession(cwd, { navigate: true });
			const created = await ctx.conversation.sendPrompt(prompt);
			if (created.status === "failed") throw new Error(created.error?.message ?? "sendPrompt failed");
			return "opened";
		},
	};
	bridges.set(ctx, bridge);
	return bridge;
}

/** 活动面板组件：cwd 由宿主 tab 上下文给出，而不是活跃会话。 */
function TriageTab() {
	const { cwd } = useActivityTab();
	const ctx = getRuntime();
	if (!ctx) return null;
	return <TriageWorkbench bridge={bridgeFor(ctx)} cwd={cwd} />;
}

export default definePlugin({
	activate(ctx) {
		setRuntime(ctx);
		const disposables = registerTools(ctx);

		try {
			ctx.ui.registerActivityTab({
				id: "frostbreak",
				label: "%tab.label%",
				component: TriageTab,
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
