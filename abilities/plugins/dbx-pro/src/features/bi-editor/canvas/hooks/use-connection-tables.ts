/**
 * use-connection-tables.ts — 按连接名拉取表列表，供属性面板的「选表」下拉使用。
 *
 * 为什么需要它：表名字段在 schema 里是自由文本（node-schema.ts），用户必须凭记忆手打
 * 表名，打错一个字符就只会在执行时收到 SQL 报错。引擎已经有 POST /tables，这里把它接上。
 *
 * 设计约束：
 * - 连接名为空 → 不发请求（画布上大量节点没有连接，避免无谓 IO）。
 * - 模块级缓存：同一连接名在一次会话内只请求一次，多个节点/多次选中共享结果。
 * - 错误一律捕获进 state，不向上抛：渲染路径抛异常会让整个属性面板白屏，
 *   失败时调用方退回自由文本输入并显示原因即可。
 */

import { useEffect, useState } from "react";
import { engineListTables } from "../../../../shared/services/engine-client";

export interface ConnectionTablesState {
	tables: string[];
	loading: boolean;
	error: string | null;
}

const EMPTY: ConnectionTablesState = { tables: [], loading: false, error: null };

/** 已成功的连接名 → 表名列表。 */
const tableCache = new Map<string, string[]>();
/** 进行中的请求，避免同一连接被并发拉取多次。 */
const inflight = new Map<string, Promise<string[]>>();

function fetchTables(connectionName: string): Promise<string[]> {
	const cached = tableCache.get(connectionName);
	if (cached) return Promise.resolve(cached);

	const existing = inflight.get(connectionName);
	if (existing) return existing;

	const task = engineListTables(connectionName)
		.then((outcome) => {
			const names = (outcome.tables ?? []).map((t) => t.name).filter(Boolean);
			tableCache.set(connectionName, names);
			return names;
		})
		.finally(() => {
			inflight.delete(connectionName);
		});

	inflight.set(connectionName, task);
	return task;
}

/** 清空缓存；连接列表刷新后调用，避免表结构变更后一直读到旧列表。 */
export function clearConnectionTablesCache(connectionName?: string): void {
	if (connectionName === undefined) tableCache.clear();
	else tableCache.delete(connectionName);
}

export function useConnectionTables(connectionName: string | null | undefined): ConnectionTablesState {
	const name = typeof connectionName === "string" ? connectionName.trim() : "";
	const [state, setState] = useState<ConnectionTablesState>(() => {
		if (!name) return EMPTY;
		const cached = tableCache.get(name);
		return cached ? { tables: cached, loading: false, error: null } : { tables: [], loading: true, error: null };
	});

	useEffect(() => {
		if (!name) {
			setState(EMPTY);
			return;
		}

		const cached = tableCache.get(name);
		if (cached) {
			setState({ tables: cached, loading: false, error: null });
			return;
		}

		let alive = true;
		setState({ tables: [], loading: true, error: null });

		fetchTables(name)
			.then((tables) => {
				if (alive) setState({ tables, loading: false, error: null });
			})
			.catch((error: unknown) => {
				if (!alive) return;
				const message = error instanceof Error ? error.message : String(error);
				setState({ tables: [], loading: false, error: message });
			});

		return () => {
			alive = false;
		};
	}, [name]);

	return state;
}
