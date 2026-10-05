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
import {
	engineExecuteByName,
	engineListSchemas,
	engineRemoveConnection,
} from "../../../shared/services/engine-client.ts";
import {
	defaultHostPlaceholder,
	defaultUsernameFor,
	emptyConnection,
	groupManifestByCategory,
	isFileBasedDbType,
} from "../services/connection-type-catalog.ts";

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
	save: () => Promise<void>;
	remove: (conn: DbConnection) => Promise<void>;
	test: (conn: DbConnection) => Promise<void>;
	/** 可勾选的该库全部 schema（拉取后填充）。 */
	availableSchemas: string[];
	loadingSchemas: boolean;
	/** 先落盘草稿再枚举该库 schema，供多选。 */
	loadSchemas: () => Promise<void>;
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

	function setViewForm(conn: DbConnection): void {
		setEditing(conn);
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
			const entry = DB_TYPE_MANIFEST.find((e) => e.dbType === dbType);
			const fileBased = isFileBasedDbType(dbType);
			return {
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
		});
	}

	async function save(): Promise<void> {
		if (!editing) return;
		if (!editing.name.trim()) {
			alert("请填写连接名称");
			return;
		}
		try {
			savedRef.current = true;
			await writeConfig(editing);
			await refresh();
			onChange?.(editing.name);
			back();
		} catch (err) {
			alert(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function remove(conn: DbConnection): Promise<void> {
		if (!confirm(`删除连接 "${conn.name}" ？此操作不可撤销。`)) return;
		try {
			await deleteConfig(conn.id);
			await refresh();
			onChange?.(conn.name);
		} catch (err) {
			alert(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	/**
	 * 测试连通性：先落盘（dbx-mcp 只认已存连接），再真跑一次 SELECT 1。
	 * 只校验配置字段是不行的 —— 凭据错误、库不存在都要执行阶段才暴露。
	 */
	async function test(conn: DbConnection): Promise<void> {
		setTesting(true);
		setTestResult(null);
		try {
			await writeConfig(conn);
			await engineExecuteByName(conn.name, "SELECT 1 AS ok", { timeoutMs: 10_000 });
			// 测试未改 schema 选择：只刷新连接，不失效树（避免折叠已展开节点）。
			onChange?.();
			setTestResult("✅ 连接成功 · 取数路径：引擎");
		} catch (err) {
			const code = (err as { code?: string } | null)?.code;
			setTestResult(`❌ 连接失败${code ? ` [${code}]` : ""}: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setTesting(false);
		}
	}

	/**
	 * 拉取该库全部 schema 供多选：dbx-mcp 只认已存连接，先把草稿落盘再枚举。
	 * 草稿凭据会一起保存，与「测试」走同一安全路径。
	 */
	async function loadSchemas(): Promise<void> {
		if (!editing || !editing.name.trim()) { alert("请先填写连接名称"); return; }
		setLoadingSchemas(true);
		try {
			await writeConfig(editing);
			const outcome = await engineListSchemas(editing.name, editing.db_type);
			setAvailableSchemas(outcome.supported ? outcome.schemas : []);
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err);
			const errCode = (err as { code?: string } | null)?.code;
			if (errCode === "ENGINE_NOT_READY") {
				alert("拉取 Schema 失败: 引擎服务尚未就绪，请稍等片刻后重试。");
			} else if (errMsg.includes("no PostgreSQL user name") || errMsg.includes("28000")) {
				alert("拉取 Schema 失败: 数据库连接缺少用户名，请检查连接配置。");
			} else if (errMsg.includes("Service is not ready")) {
				alert("拉取 Schema 失败: 引擎服务正在启动中，请稍等片刻后重试。");
			} else {
				alert(`拉取 Schema 失败: ${errMsg}`);
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
		save,
		remove,
		test,
		availableSchemas,
		loadingSchemas,
		loadSchemas,
		groupedManifest,
	};
}