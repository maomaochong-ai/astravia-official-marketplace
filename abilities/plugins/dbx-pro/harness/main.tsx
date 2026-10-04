// 临时：浏览器验证夹具入口 — mock 宿主 ctx + mock 引擎，验证后删除。
import { createRoot } from "react-dom/client";
import { type JSX } from "react";
import { setRuntime } from "../src/runtime-contract";
import { bindEngineServices } from "../src/shared/services/engine-client";
import { DatabaseWorkspace } from "../src/features/database-workspace/components/database-workspace";
import "../src/style.css";

// ── mock 宿主存储 / 凭据库 ─────────────────────────────
const files = new Map<string, string>();
const storage = {
	async readFile(path: string): Promise<string | null> {
		return files.has(path) ? files.get(path)! : null;
	},
	async writeFile(path: string, data: string): Promise<{ path: string }> {
		files.set(path, data);
		return { path };
	},
};
const secretMap = new Map<string, string>();
const secrets = {
	async get(k: string): Promise<string | null> {
		return secretMap.get(k) ?? null;
	},
	async set(k: string, v: string): Promise<void> {
		secretMap.set(k, v);
	},
	async delete(k: string): Promise<void> {
		secretMap.delete(k);
	},
};

setRuntime({
	storage,
	secrets,
	command: {},
	conversation: { insertText() {} },
	services: null,
});

// ── mock 引擎 HTTP ────────────────────────────────────
function envelope<T>(data: T): unknown {
	return { ok: true, data };
}

const rows = Array.from({ length: 8 }, (_, i) => ({
	id: i + 1,
	name: `用户 ${i + 1}`,
	email: `user${i + 1}@example.com`,
}));

async function handle(path: string, body: any): Promise<unknown> {
	if (path === "/health") {
		return envelope({
			status: "ok", version: "test", protocol: 1, pid: 1,
			node: "v22", platform: "darwin", uptimeMs: 1, auth: "disabled",
			pool: { size: 0, invalidations: 0, connections: [] },
			drivers: [{ id: "pg", label: "PostgreSQL", tier: "native", ready: true }],
		});
	}
	if (path === "/connections" && body === undefined) {
		return envelope({
			connections: [{
				id: "c1", name: "demo-pg", groupPath: "", type: "postgresql",
				host: "localhost", port: 5432, database: "demo",
			}],
		});
	}
	if (path === "/connections") {
		// 新增（含 dbType）/ 删除（仅 name）
		return body && "dbType" in body
			? envelope({ id: "c1", name: body.name })
			: envelope({ deleted: body.name });
	}
	if (path === "/connections/test") return envelope({ tableCount: 1 });
	if (path === "/schemas") {
		return envelope({ connection: body.connectionName, supported: false, schemas: [] });
	}
	if (path === "/tables") {
		return envelope({
			connection: body.connectionName,
			tables: [
				{ name: "users", kind: "table" },
				{ name: "orders", kind: "table" },
			],
		});
	}
	if (path === "/describe") {
		return envelope({
			connection: body.connectionName,
			table: body.target.table,
			columns: [
				{ name: "id", type: "integer", nullable: false, hasDefault: true, defaultValue: "nextval(...)", comment: "", isPrimaryKey: true },
				{ name: "name", type: "text", nullable: false, hasDefault: false, defaultValue: "", comment: "用户名", isPrimaryKey: false },
				{ name: "email", type: "text", nullable: true, hasDefault: false, defaultValue: "", comment: "", isPrimaryKey: false },
			],
		});
	}
	if (path === "/query") {
		await new Promise((r) => setTimeout(r, 1200));
		return envelope({
			connection: body.connectionName,
			kind: "select",
			statement_count: 1,
			statements: [{
				sql: body.sql, kind: "select", columns: ["id", "name", "email"],
				rows, row_count: 8, affected_rows: 0, truncated: false,
			}],
			truncated: false,
			row_limit: body.rowLimit ?? 1000,
			max_rows: 100000,
			timeout_ms: body.timeoutMs ?? 30000,
			duration_ms: 42,
			columns: ["id", "name", "email"],
			rows,
			row_count: 8,
			affected_rows: 0,
		});
	}
	throw new Error(`unhandled ${path}`);
}

bindEngineServices({
	async request(_serviceId: string, req: { path: string; body?: unknown }) {
		const body = await handle(req.path, req.body as never);
		return {
			ok: true, status: 200, statusText: "OK", headers: {}, body,
		};
	},
} as Parameters<typeof bindEngineServices>[0]);

function Harness(): JSX.Element {
	return (
		<div style={{ position: "fixed", inset: 0 }}>
			<DatabaseWorkspace />
		</div>
	);
}

createRoot(document.getElementById("root")!).render(<Harness />);
