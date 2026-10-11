/**
 * 连接编辑流程 — 侧栏的异步状态机。
 *
 * 覆盖：加载连接列表、新建 / 编辑草稿、切换数据库类型时修正端点默认值、
 * 保存、删除、测试连通性（真实跑一次 SELECT 1，不靠配置推断）。
 * 组件只渲染这个 hook 暴露的状态与动作，不自己发请求。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { DbConnection } from "../../../domain/connection-config.ts";
import { DB_TYPE_MANIFEST } from "../../../domain/connection-config.ts";
import { deleteConfig, readAllConfigs, writeConfig } from "../../../domain/dbx-storage.ts";
import { getUi } from "../../../runtime-contract.ts";
import {
	engineExecuteByName,
	engineListSchemas,
	engineRemoveConnection,
	engineSaveApiSource,
	engineTestApiSource,
	type EngineApiSourceSaveSpec,
} from "../../../shared/services/engine-client.ts";
import {
	defaultHostPlaceholder,
	defaultUsernameFor,
	emptyApiConnection,
	emptyConnection,
	groupManifestByCategory,
	isApiConnectionType,
	isFileBasedDbType,
} from "../services/connection-type-catalog.ts";
import { apiSpecOf } from "../services/api-connection-form.ts";

export interface ConnectionEditorState {
	connections: DbConnection[];
	/** 正在编辑的草稿；null 表示不在表单态。 */
	editing: DbConnection | null;
	/** 侧栏当前页：列表还是表单。 */
	view: "list" | "form";
	testing: boolean;
	/** 测试结果文案；null 表示不显示。 */
	testResult: string | null;
	/** 替换当前草稿（字段表单的受控输入）。 */
	setEditing: (conn: DbConnection) => void;
	/** 切换数据库类型（修正默认端口 / host / 用户名）。 */
	setDbType: (dbType: string) => void;
	startNew: () => void;
	startEdit: (conn: DbConnection) => void;
	/** 从表单退回列表。 */
	back: () => void;
	/** 重新从存储加载连接列表。 */
	refresh: () => Promise<void>;
	/** 保存成功（已落盘并退回列表）返回 true；校验失败或出错返回 false。 */
	save: () => Promise<boolean>;
	remove: (conn: DbConnection) => Promise<void>;
	test: (conn: DbConnection) => Promise<void>;
	/** 可勾选的该库全部 schema（拉取后填充）。 */
	availableSchemas: string[];
	loadingSchemas: boolean;
	/** 先落盘草稿再枚举该库 schema，供多选。 */
	loadSchemas: () => Promise<void>;
	/** 批量诊断：对所有已保存连接逐个跑连通性测试。返回汇总结果。 */
	diagnoseAll: () => Promise<{
		ok: number;
		fail: number;
		total: number;
		results: Record<string, { ok: boolean; error?: string; ms: number }>;
	}>;
	/** 按 category 分组后的类型清单，给下拉框用。 */
	groupedManifest: ReturnType<typeof groupManifestByCategory>;
}

export interface UseConnectionEditorOptions {
	/** 连接增 / 删 / 改完成后通知外层重载工作台（回传受影响连接名）。 */
	onChange?: (name?: string) => void;
}

export function useConnectionEditor(options: UseConnectionEditorOptions = {}): ConnectionEditorState {
	const { onChange } = options;
	const [connections, setConnections] = useState<DbConnection[]>([]);
	const [editing, setEditing] = useState<DbConnection | null>(null);
	const [view, setView] = useState<"list" | "form">("list");
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<string | null>(null);
	const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
	const [loadingSchemas, setLoadingSchemas] = useState(false);
	/** 当前草稿是否为「新建」（区别于编辑已有）；是否已显式保存。用于取消时回滚幽灵连接。 */
	const isNewDraftRef = useRef(false);
	const savedRef = useRef(false);

	useEffect(() => {
		void (async () => {
			setConnections(await readAllConfigs().catch(() => [] as DbConnection[]));
		})();
	}, []);

	async function refresh(): Promise<void> {
		try {
			setConnections(await readAllConfigs());
		} catch {
			setConnections([]);
		}
	}

	function startNew(): void {
		setEditing(emptyConnection());
		setTestResult(null);
		setAvailableSchemas([]);
		isNewDraftRef.current = true;
		savedRef.current = false;
		setView("form");
	}

	function startEdit(conn: DbConnection): void {
		setEditing({ ...conn });
		setTestResult(null);
		setAvailableSchemas([]);
		isNewDraftRef.current = false;
		savedRef.current = false;
		setView("form");
	}

	function back(): void {
		const draftName = editing?.name?.trim() || "";
		// 新建草稿若未显式保存，「拉取 Schema」可能已把它落盘；取消时回滚，避免幽灵连接。
		const shouldRollback = isNewDraftRef.current && !savedRef.current && draftName.length > 0;
		setEditing(null);
		setTestResult(null);
		setAvailableSchemas([]);
		setView("list");
		if (shouldRollback) {
			void engineRemoveConnection(draftName).catch(() => { /* 可能本就未创建 */ });
		}
	}

	/**
	 * 换数据库类型时只修正「用户还没自定义过」的字段：
	 * 已填的 host / 用户名一律保留，避免用户输入被悄悄改掉。
	 */
	function setDbType(dbType: string): void {
		setEditing((prev) => {
			if (!prev) return prev;
			// 「API 接入」没有端点概念：换成它时丢掉 host / 端口 / 凭据，换成别的时丢掉 api 配置。
			if (isApiConnectionType(dbType)) {
				return {
					...emptyApiConnection(),
					id: prev.id,
					name: prev.name,
					note: prev.note,
					is_production: prev.is_production,
				};
			}
			const entry = DB_TYPE_MANIFEST.find((e) => e.dbType === dbType);
			const fileBased = isFileBasedDbType(dbType);
			const next: DbConnection = {
				...prev,
				db_type: dbType,
				port: entry?.defaultPort ?? prev.port,
				host: prev.host
					? fileBased
						? prev.host === "localhost" ? defaultHostPlaceholder(dbType) : prev.host
						: prev.host.startsWith("/") ? "localhost" : prev.host
					: fileBased ? defaultHostPlaceholder(dbType) : "localhost",
				username: prev.username ? prev.username : defaultUsernameFor(dbType),
			};
			if (isApiConnectionType(prev.db_type)) delete next.api;
			return next;
		});
	}

	/** API 接入的落盘 / 测试载荷：引擎连接那套 host / port 字段对它无意义。 */
	function apiSourcePayload(conn: DbConnection): EngineApiSourceSaveSpec {
		const spec = apiSpecOf(conn);
		const payload: EngineApiSourceSaveSpec = {
			name: conn.name.trim(),
			url: spec.url,
			method: "GET",
			auth: spec.auth ?? { kind: "none" },
			dataPath: spec.dataPath ?? "",
			rowLimit: spec.rowLimit ?? 1000,
		};
		// 缺省（没这个键）= 沿用服务端已存值；表单里那个框没被动过就是这种情况。
		// 只要有过输入就会带上键（甚至空对象）——「显式清空」得真能清掉。
		if (spec.headers !== undefined) payload.headers = spec.headers;
		if (spec.token) payload.token = spec.token;
		return payload;
	}

	async function save(): Promise<boolean> {
		if (!editing) return false;
		if (!editing.name.trim()) {
			getUi()?.notify?.({ message: "请填写连接名称", variant: "info" });
			return false;
		}
		const isApi = isApiConnectionType(editing.db_type);
		if (isApi && !apiSpecOf(editing).url.trim()) {
			getUi()?.notify?.({ message: "请填写接口地址", variant: "info" });
			return false;
		}
		try {
			savedRef.current = true;
			// 非 API：把 ssl_mode 自动拼进 url_params（引擎层不认识 ssl_mode，只认 URL 参数）。
			// MySQL / MariaDB 用 ssl-mode=，Postgres / Redshift / Dameng 用 sslmode=。
			let payload: DbConnection = editing;
			if (!isApi && editing.ssl_mode && editing.ssl_mode !== "disable") {
				const dbType = editing.db_type;
				const isMysqlFamily = dbType === "mysql" || dbType === "mariadb" || dbType === "sqlserver";
				const paramKey = isMysqlFamily ? "ssl-mode" : "sslmode";
				const base = editing.url_params?.trim()
					? editing.url_params.replace(/[?&]$/, "")
					: "";
				// 剔除旧值（同 key 不同写法也一起清），避免反复保存时堆叠
				const filtered = base
					.split("&")
					.filter((kv) => kv && !/^(sslmode|ssl-mode|ssl)\s*=/.test(kv.trimStart()))
					.join("&");
				const merged = filtered
					? `${filtered}&${paramKey}=${editing.ssl_mode}`
					: `${paramKey}=${editing.ssl_mode}`;
				payload = { ...editing, url_params: merged };
			}
			if (isApi) await engineSaveApiSource(apiSourcePayload(payload));
			else await writeConfig(payload);
			await refresh();
			onChange?.(editing.name);
			back();
			return true;
		} catch (err) {
			getUi()?.notify?.({ message: `保存失败: ${err instanceof Error ? err.message : String(err)}`, variant: "error" });
			return false;
		}
	}

	async function remove(conn: DbConnection): Promise<void> {
		try {
			await deleteConfig(conn.id);
			await refresh();
			onChange?.(conn.name);
		} catch (err) {
			getUi()?.notify?.({ message: `删除失败: ${err instanceof Error ? err.message : String(err)}`, variant: "error" });
		}
	}

	/**
	 * 测试连通性。
	 *
	 * 数据库：先落盘（引擎只认已存连接），再真跑一次 SELECT 1 —— 只校验配置字段
	 * 是不行的，凭据错误、库不存在都要执行阶段才暴露。
	 * API 接入：不落盘，把草稿直接交给服务端抓一次，避免为了试错而存配置。
	 *
	 * 测试结果写入 last_test_at / last_test_ok / last_test_error 并持久化到存储，
	 * 这样连接列表右侧行能显示最新状态 chip 而不是硬编码「已配置」。
	 */
	async function test(conn: DbConnection): Promise<void> {
		setTesting(true);
		setTestResult(null);
		const started = performance.now();
		let ok = false;
		let errorMsg: string | undefined;
		try {
			if (isApiConnectionType(conn.db_type)) {
				if (!conn.name.trim()) { setTestResult("❌ 请先填写连接名称"); return; }
				if (!apiSpecOf(conn).url.trim()) { setTestResult("❌ 请先填写接口地址"); return; }
				const payload = apiSourcePayload(conn);
				const outcome = await engineTestApiSource({
					name: conn.name.trim(),
					draft: payload,
					// secret 必须提至顶层 —— 后端 /api-sources/test 只认 body.token，不认 draft.token
					token: payload.token,
				});
				ok = true;
				setTestResult(
					`✅ 接口可达 · HTTP ${outcome.status} · 取到 ${outcome.row_count} 行 / ${outcome.columns.length} 列 · ${outcome.duration_ms}ms · 取数路径：插件直连`,
				);
			} else {
				await writeConfig(conn);
				await engineExecuteByName(conn.name, "SELECT 1 AS ok", { timeoutMs: 10_000 });
				const elapsed = Math.round(performance.now() - started);
				ok = true;
				// 测试未改 schema 选择：只刷新连接，不失效树（避免折叠已展开节点）。
				onChange?.();
				setTestResult(`✅ 连接成功 · ${elapsed} ms · 取数路径：引擎`);
			}
		} catch (err) {
			const elapsed = Math.round(performance.now() - started);
			const code = (err as { code?: string } | null)?.code;
			errorMsg = code ? `[${code}] ${err instanceof Error ? err.message : String(err)}` : (err instanceof Error ? err.message : String(err));
			setTestResult(`❌ 连接失败${code ? ` [${code}]` : ""}（${elapsed} ms）: ${errorMsg}`);
		} finally {
			setTesting(false);
			// 持久化测试状态到存储 —— 连接列表和批量诊断都要读
			try {
				const patched: DbConnection = {
					...conn,
					last_test_at: Date.now(),
					last_test_ok: ok,
					last_test_error: ok ? undefined : errorMsg,
				};
				if (isApiConnectionType(conn.db_type)) {
					// API 接入也把状态存本地（引擎的 /api-sources/save 不认识 last_test_*，走本地 writeConfig 存）
					await writeConfig(patched);
				} else {
					await writeConfig(patched);
				}
				await refresh();
				onChange?.();
			} catch { /* 持久化失败不阻断测试结果 */ }
		}
	}

	/**
	 * 连接诊断（自研批量测试）：对所有已保存连接逐个跑 test()，
	 * 不阻塞 UI（每个连接独立计时 + 独立状态）。返回汇总结果供 UI 渲染。
	 */
	async function diagnoseAll(): Promise<{
		ok: number;
		fail: number;
		total: number;
		results: Record<string, { ok: boolean; error?: string; ms: number }>;
	}> {
		const results: Record<string, { ok: boolean; error?: string; ms: number }> = {};
		for (const conn of connections) {
			const started = performance.now();
			try {
				if (isApiConnectionType(conn.db_type)) {
					const p = apiSourcePayload(conn);
					await engineTestApiSource({ name: conn.name, draft: p, token: p.token });
				} else {
					await engineExecuteByName(conn.name, "SELECT 1 AS ok", { timeoutMs: 10_000 });
				}
				const ms = Math.round(performance.now() - started);
				results[conn.id] = { ok: true, ms };
			} catch (err) {
				const ms = Math.round(performance.now() - started);
				const msg = err instanceof Error ? err.message : String(err);
				results[conn.id] = { ok: false, error: msg, ms };
			}
		}
		// 诊断结束后持久化每个连接的状态
		for (const conn of connections) {
			const r = results[conn.id];
			if (!r) continue;
			try {
				await writeConfig({
					...conn,
					last_test_at: Date.now(),
					last_test_ok: r.ok,
					last_test_error: r.ok ? undefined : r.error,
				});
			} catch { /* 忽略 */ }
		}
		await refresh();
		onChange?.();
		const entries = Object.values(results);
		const ok = entries.filter((r) => r.ok).length;
		return { ok, fail: entries.length - ok, total: entries.length, results };
	}

	/**
	 * 拉取该库全部 schema 供多选：引擎只认已存连接，先把草稿落盘再枚举。
	 * 草稿凭据会一起保存，与「测试」走同一安全路径。
	 */
	async function loadSchemas(): Promise<void> {
		if (!editing || !editing.name.trim()) { getUi()?.notify?.({ message: "请先填写连接名称", variant: "info" }); return; }
		setLoadingSchemas(true);
		try {
			await writeConfig(editing);
			const outcome = await engineListSchemas(editing.name, editing.db_type);
			setAvailableSchemas(outcome.supported ? outcome.schemas : []);
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			const errCode = (err as { code?: string } | null)?.code;
			if (errCode === "ENGINE_NOT_READY") {
				getUi()?.notify?.({ message: "拉取 Schema 失败: 引擎服务尚未就绪，请稍等片刻后重试。", variant: "error" });
			} else if (errMsg.includes("no PostgreSQL user name") || errMsg.includes("28000")) {
				getUi()?.notify?.({ message: "拉取 Schema 失败: 数据库连接缺少用户名，请检查连接配置。", variant: "error" });
			} else if (errMsg.includes("Service is not ready")) {
				getUi()?.notify?.({ message: "拉取 Schema 失败: 引擎服务正在启动中，请稍等片刻后重试。", variant: "error" });
			} else {
				getUi()?.notify?.({ message: `拉取 Schema 失败: ${errMsg}`, variant: "error" });
			}
		} finally {
			setLoadingSchemas(false);
		}
	}

	const groupedManifest = useMemo(() => groupManifestByCategory(), []);

	return {
		connections,
		editing,
		view,
		testing,
		testResult,
		setEditing,
		setDbType,
		startNew,
		startEdit,
		back,
		refresh,
		save,
		remove,
		test,
		availableSchemas,
		loadingSchemas,
		loadSchemas,
		diagnoseAll,
		groupedManifest,
	};
}