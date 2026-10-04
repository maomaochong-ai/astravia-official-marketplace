// 临时：浏览器验证夹具入口 — 对接真实引擎（经 Vite 代理 → server/main.mjs），
// 验证后删除。
import { createRoot } from "react-dom/client";
import { type JSX } from "react";
import { setRuntime } from "../src/runtime-contract";
import {
	bindEngineServices,
	type EngineServiceResponse,
	type EngineServicesApi,
} from "../src/shared/services/engine-client";
import { DatabaseWorkspace } from "../src/features/database-workspace/components/database-workspace";
import "../src/style.css";

// ── mock 宿主存储 / 凭据库（夹具本地） ──────────────────
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

// ── mock conversation：记录所有发送，供页面核对 ──────────
const log: string[] = [];
const conversation = {
	insertText(text: string): void {
		log.push(`[insertText] ${text}`);
		renderLog();
	},
	async sendPrompt(text: string): Promise<{ status: "sent" }> {
		log.push(`[sendPrompt] ${text}`);
		renderLog();
		return { status: "sent" };
	},
	async createSession(): Promise<unknown> {
		log.push("[createSession]");
		return { id: "harness-session", cwd: ".", sessionPath: null, model: null, isStreaming: false };
	},
	on(): { dispose: () => void } {
		return { dispose() {} };
	},
};

setRuntime({
	storage,
	secrets,
	command: {},
	conversation,
	services: null,
} as Parameters<typeof setRuntime>[0]);

// ── 真实引擎 HTTP（经 Vite 代理 /engine-api → :8899） ────
const api: EngineServicesApi = {
	async request<T>(
		_serviceId: string,
		req: {
			path: string;
			method?: string;
			headers?: Record<string, string>;
			body?: unknown;
			responseType?: "json" | "text";
			timeoutMs?: number;
		},
	): Promise<EngineServiceResponse<T>> {
		const resp = await fetch(`/engine-api${req.path}`, {
			method: req.method ?? (req.body === undefined ? "GET" : "POST"),
			headers: { "content-type": "application/json", ...(req.headers ?? {}) },
			body: req.body === undefined ? undefined : JSON.stringify(req.body),
		});
		const body = (await resp.json()) as T;
		return {
			ok: resp.ok,
			status: resp.status,
			statusText: resp.statusText,
			headers: {},
			body,
		};
	},
};
bindEngineServices(api);

// ── 角落：展示发送记录（核对上下文准确性） ───────────────
function renderLog(): void {
	const el = document.getElementById("harness-log");
	if (el) el.textContent = log.slice(-6).join("\n\n");
}

function Harness(): JSX.Element {
	return (
		<div style={{ position: "fixed", inset: 0 }}>
			<DatabaseWorkspace />
			<pre
				id="harness-log"
				style={{
					position: "absolute",
					right: 8,
					bottom: 8,
					maxWidth: 360,
					maxHeight: 200,
					overflow: "auto",
					margin: 0,
					padding: 8,
					fontSize: 10,
					background: "rgba(0,0,0,0.7)",
					color: "#9ef",
					borderRadius: 6,
					zIndex: 500,
					whiteSpace: "pre-wrap",
				}}
			/>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(<Harness />);
