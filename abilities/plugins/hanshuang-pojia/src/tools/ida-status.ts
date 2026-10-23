import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";

/** 上游 `seep_ida_status` 探测的是同一个端口：IDA Pro 里的 MCP 桥默认监听 13337。 */
const IDA_MCP_PORT = 13_337;
const PROBE_TIMEOUT_MS = 2_000;
const IDA_MANUAL_DOC = "manual/IDA-PRO";

/**
 * IDA 联动状态。上游这个工具只做一件事：向 `127.0.0.1:13337` 发一次 GET，
 * 通了就说可以调 `mcp_ida_*`，不通就提示去 IDA 里唤醒插件。
 *
 * 插件侧照做，但把三种「不通」分开，因为修法完全不同：
 * - 宿主没给 `network.fetch`，或清单没声明 `127.0.0.1` → 是权限/清单问题，装什么都不会通；
 * - 端口没服务 → 是 IDA 里桥没起，或 IDA 没开；
 * - 有服务但回 4xx → 仍然算在线（MCP 的 GET 本来就可能被拒），不能报离线。
 *
 * 探测只到回包为止，不解析 MCP 协议：这个工具回答「在不在」，工具清单由宿主的 MCP
 * 面板管理，插件不去猜别人的能力。
 */
export function registerIdaStatusTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<Record<string, never>>({
		id: "ida_status",
		name: "ida_status",
		label: "%tool.ida.label%",
		description: [
			"Check whether an IDA Pro bridge is listening on this machine at 127.0.0.1:13337, so you know whether",
			"deep decompilation and cross-reference work can go through IDA or has to stay with the plugin's own",
			"decoders and radare2.",
			"",
			"Any HTTP answer counts as online, including 4xx — the bridge answering at all is what matters. A",
			"refused or timed-out connection means nothing is listening on that port right now.",
			"",
			"The plugin never installs, starts or drives IDA, and never reads its licence state. When the answer is",
			"offline, the next step is the IDA manual in this kit (`read_doc` with `manual/IDA-PRO`) and, if the user",
			"wants it, starting IDA themselves — this tool only reports.",
		].join("\n"),
		parameters: { type: "object", properties: {}, additionalProperties: false },
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 15_000,
		handler: async () => {
			const manual = `Next step if you need IDA depth: \`read_doc\` with \`${IDA_MANUAL_DOC}\` for the setup, then ask the user to start IDA and load the bridge.`;

			if (!ctx.permissions.has("network.fetch")) {
				return [
					"Cannot probe IDA: this plugin instance was not granted `network.fetch`, so 127.0.0.1:13337 is unreachable from here.",
					"That is a permission question, not evidence that IDA is missing — do not conclude the bridge is down.",
					manual,
				].join("\n");
			}
			const network = ctx.network;
			if (!network || typeof network.request !== "function") {
				return [
					`Cannot probe IDA: this host exposes no network API, so 127.0.0.1:${IDA_MCP_PORT} was not contacted.`,
					manual,
				].join("\n");
			}

			const started = Date.now();
			try {
				const response = await network.request({
					url: `http://127.0.0.1:${IDA_MCP_PORT}/`,
					method: "GET",
					timeoutMs: PROBE_TIMEOUT_MS,
					responseType: "text",
				});
				return [
					`IDA bridge: listening on 127.0.0.1:${IDA_MCP_PORT} (HTTP ${response.status} ${response.statusText}, ${Date.now() - started} ms).`,
					"",
					"Something is serving that port. The tool surface itself is the host's MCP registry, not this plugin's —",
					"call the IDA MCP tools directly if they are registered in this session; otherwise the user has to add",
					"them to the MCP configuration.",
				].join("\n");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return [
					`IDA bridge: nothing answered on 127.0.0.1:${IDA_MCP_PORT} within ${PROBE_TIMEOUT_MS} ms.`,
					`Detail: ${message}`,
					"",
					"That means no listener right now. It does not mean IDA is not installed, and it does not license",
					"giving up on the sample: the plugin's own PE/ELF/Mach-O decoders, `disassemble_range`,",
					"`decompile_function` and radare2 cover static work without IDA.",
					manual,
				].join("\n");
			}
		},
	});
}
