import { definePlugin, useTranslation } from "@astravia-org/plugin-sdk";
import type { JSX } from "react";
import { isWindows } from "./domain/platform";
import { readLocalFacts } from "./features/console/services/local-facts";
import { TodeskConsoleView } from "./features/console/components/todesk-console-view";
import { registerTodeskPlugin } from "./plugin-registration";
import type { ConsoleDeps } from "./runtime-contract";
import "./style.css";

const SETTINGS_FILE = "settings.json";

/**
 * ToDesk, wired the way the user asked: install it, ask the agent, it connects.
 *
 * Everything goes through ToDesk's documented command line (`-status`, `-control`,
 * `-autostart`). There is no MCP dependency: that endpoint belongs to ToDesk's AI
 * subsystem, cannot be switched on from the client, and never connected — presenting it
 * only produced dead controls (ADR 0005).
 */
export default definePlugin({
	activate(ctx): (() => void) | void {
		const readSettings = async (): Promise<Record<string, unknown> | null> => {
			const raw = await ctx.storage.readFile(SETTINGS_FILE, "utf8");
			if (!raw) return null;
			try {
				const parsed: unknown = JSON.parse(raw);
				return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
			} catch {
				return null;
			}
		};

		const deps: ConsoleDeps = {
			async readTextFile(path) {
				const result = await ctx.fs.readFile(path);
				return result.content;
			},
			// ToDesk keeps its device list and usage counters under %LOCALAPPDATA%, and the
			// plugin API exposes no home/env lookup — so the profile is discovered by listing
			// C:\Users. This is the only way those files are reachable.
			async listDirectory(path) {
				const entries = await ctx.fs.readDir(path);
				return entries.map((entry) => ({ name: entry.name, path: entry.path, isDirectory: entry.isDirectory }));
			},
			readSettings,
			writeSettings: async (value) => {
				await ctx.storage.writeFile(SETTINGS_FILE, JSON.stringify(value, null, 2), "utf8");
			},
			openExternal: (url) => ctx.ui.openExternal(url),
			// The exit code is passed through untouched: ToDesk returns 1 on success, so
			// the parsers — not this adapter — decide what the output means.
			async run(file, args, env) {
				const result = await ctx.command.run(file, args, env ? { env } : undefined);
				return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
			},
			notifyError(message, error) {
				ctx.ui.notify({ message, error: error instanceof Error ? error : new Error(String(error)) });
			},
			notify(message) {
				ctx.ui.notify({ message, variant: "success" });
			},
		};

		const canRun = isWindows(navigator.userAgent);

		// One probe at activation, recorded into settings: it is the only place the host's
		// own `command.run` verdict becomes visible without a click.
		void (async () => {
			try {
				const local = await readLocalFacts(deps);
				const current = (await readSettings()) ?? {};
				await deps.writeSettings({
					...current,
					lastLaunch: {
						ok: Boolean(local.deviceId),
						source: local.source,
						error: local.launchError,
						at: new Date().toISOString(),
					},
				});
			} catch {
				// A failed probe must not break activation.
			}
		})();

		// MF fills shared deps (including the jsx runtime) asynchronously; keep JSX
		// inside the component, never at module scope.
		function TodeskSurface(): JSX.Element {
			const { t } = useTranslation();
			return <TodeskConsoleView deps={deps} t={t} canRun={canRun} />;
		}

		return registerTodeskPlugin(ctx, deps, TodeskSurface).dispose;
	},
});
