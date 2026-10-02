import "./style.css";
import { definePlugin, type PluginCommandApi } from "@astravia-org/plugin-sdk";
import { DbxProPanel } from "./DbxProPanel";

/**
 * 把宿主的 PluginCommandApi 存到模块级变量——React 组件通过 getCommand() 拿到。
 * 这和 plugin-workbench 的 setWorkbenchRuntime 是同一个模式。
 */
let _command: PluginCommandApi | null = null;

export function setCommand(c: PluginCommandApi) { _command = c; }
export function getCommand(): PluginCommandApi {
	if (!_command) throw new Error("dbx-pro plugin not activated yet");
	return _command;
}

export default definePlugin({
	activate(ctx) {
		setCommand(ctx.command);

		ctx.ui.registerActivityTab({
			id: "dbx-pro",
			label: { zh: "dbx-pro", en: "dbx-pro" },
			icon: (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<ellipse cx="12" cy="5" rx="8" ry="3" />
					<path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
					<path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
				</svg>
			),
			component: DbxProPanel,
			scope_use: ["project", "conversation"],
			initiallyVisible: true,
			orderAfter: ["browser"],
		});
	},
});
