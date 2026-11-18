import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";

/**
 * A compact block in every turn, so "use the remote plugin" resolves to the right tools
 * without the user naming a skill. It carries the boundary as well: a model that thinks
 * it can see the remote screen will promise things this plugin cannot do.
 *
 * Kept to four short lines on purpose — it is paid for on every request.
 */
const BLOCK_ID = "todesk-capability";

export function registerTodeskPrompt(ctx: PluginContext): Disposable {
	return ctx.agent.registerSystemPromptProvider({
		id: BLOCK_ID,
		handler: async () => [
			{
				type: "addBlock",
				block: {
					id: BLOCK_ID,
					priority: 40,
					content: [
						"ToDesk is available for remote control of the user's own machines.",
						"todesk_readiness answers \"can I leave / can they reach me\" in one call (verdict + items + fix); todesk_devices lists the machines the client saved, pinned first — prefer connecting by name over asking the user to read digits aloud; todesk_status, todesk_usage and todesk_posture answer identity, how often, and the access flags (never passwords).",
						"todesk_connect takes a saved `device` name or a 9-digit `device_id`; `password` is the far side's temporary password, needed only when that device has no saved credential. Report `established` literally — `ok: true` only means the command was accepted. todesk_disconnect runs `-exit`, todesk_tray hides the window, todesk_autostart and todesk_open_client cover reachability and the client window.",
						"The session opens in ToDesk's own window: you cannot see the remote screen or click inside it. Never claim you did.",
						"If a call answers \"command disabled by user\", the host has not granted ToDesk.exe — tell the user to allow it in 设置 → 插件 → ToDesk → 命令.",
					].join("\n"),
				},
			},
		],
	});
}
