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
						"Call todesk_status first (device code, client state); then todesk_connect with the far side's 9-digit code AND its temporary password; todesk_disconnect runs `-exit` and ends the session; todesk_autostart and todesk_open_client cover reachability and the client window.",
						"The session opens in ToDesk's own window: you cannot see the remote screen or click inside it. Never claim you did.",
						"If a call answers \"command disabled by user\", the host has not granted ToDesk.exe — tell the user to allow it in 设置 → 插件 → ToDesk → 命令.",
					].join("\n"),
				},
			},
		],
	});
}
