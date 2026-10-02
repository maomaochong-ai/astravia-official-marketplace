/**
 * 宿主运行时契约 — 持有 PluginContext 句柄。
 * 用 any 避免导入 plugin-sdk 深层类型触发 MF idle timeout。
 */

const DBX_ENV = { DBX_DATA_DIR: `${process.env.HOME}/.astravia/dbx-pro` };

let _ctx: any = null;

export function setRuntime(ctx: unknown) { _ctx = ctx; }

function requireCtx(): any {
	if (!_ctx) throw new Error("dbx-pro plugin not activated");
	return _ctx;
}

export function getCommand() { return requireCtx().command; }
export function getConversation() { return requireCtx().conversation; }

// Agent tool registration — called lazily when first needed
export function registerAgentTool(ctx: any) {
	ctx.agent.registerTool({
		id: "dbx-query",
		label: "dbx-pro 查询",
		description: "Execute SQL against a configured dbx-pro database connection.",
		parameters: {
			type: "object",
			required: ["connection", "sql"],
			properties: {
				connection: { type: "string" },
				sql: { type: "string" },
				limit: { type: "number", default: 100 },
				timeout: { type: "number", default: 30 },
				allow_writes: { type: "boolean", default: false },
			},
		},
		scope_use: ["conversation", "project"],
		timeoutMs: 60_000,
		async handler(context: any) {
			const t = context.trigger.input;
			const timeout = t.timeout ?? 30;
			const args = [
				"query", String(t.connection), String(t.sql),
				"--json", "--limit", String(t.limit ?? 100),
				"--timeout", `${timeout}s`,
			];
			if (t.allow_writes) args.push("--allow-writes");
			const result = await ctx.command.run("dbx", args, {
				timeoutMs: timeout * 1000 + 5000,
				env: DBX_ENV,
			});
			if (result.exitCode !== 0) {
				const err = result.stderr || result.stdout || `dbx exit ${result.exitCode}`;
				return { ok: false, error: String(err).slice(0, 2000) };
			}
			try { return { ok: true, result: JSON.parse(result.stdout) }; }
			catch { return { ok: true, raw: result.stdout }; }
		},
	});
}
