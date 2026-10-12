/**
 * health.mjs — GET /health
 * 只读子进程当前 phase，绝不 await/触发握手。
 */
import { ENGINE_VERSION, PROTOCOL_VERSION } from "../../engine/protocol.ts";

export function healthRoutes(ctx) {
	return [
		["/health", "GET", false, async () => {
			const c = ctx.mcpClient();
			let dbxInfo;
			if (c.phase === "ready") dbxInfo = { status: "connected" };
			else if (c.phase === "connecting") dbxInfo = { status: "connecting" };
			else if (c.phase === "error") dbxInfo = { status: "error", message: c.lastError?.message };
			else dbxInfo = { status: "idle" };
			return {
				status: "ok",
				version: ENGINE_VERSION,
				protocol: PROTOCOL_VERSION,
				row_cap: 1000,
				pid: process.pid,
				node: process.version,
				platform: `${process.platform}-${process.arch}`,
				uptimeMs: Math.round(process.uptime() * 1000),
				auth: ctx.auth?.enabled ? "enabled" : "disabled",
				dbx: dbxInfo,
				drivers: [{ id: "dbx-cli", label: "dbx CLI (100+ databases)", tier: "first-class", ready: true }],
			};
		}],
	];
}
