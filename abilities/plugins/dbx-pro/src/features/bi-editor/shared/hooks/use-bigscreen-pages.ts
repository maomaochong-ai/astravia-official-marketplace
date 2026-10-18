/**
 * use-bigscreen-pages.ts — 封装 Phase A 自研 /drag/page/* API。
 *
 * 前端走 engineRequest（→ 宿主 service 代理 → engine /drag/*），
 * 后端已套统一 {ok, data} envelope，和 connections/query 等端点一致。
 */

import { useCallback, useEffect, useState } from "react";
import { engineRequest } from "../../../../shared/services/engine-client";

export type BigscreenPage = {
	id: string;
	name: string;
	style: "bigScreen" | "default";
	theme: string;
	designType: number;
	backgroundImage: string;
	updateCount: number;
	updateTime: string;
	createTime: string;
	visits: number;
	template?: string;
};

export type BigscreenPagesList = {
	records: BigscreenPage[];
	total: number;
	size: number;
	pages: number;
	current: number;
};

export function useBigscreenPages() {
	const [pages, setPages] = useState<BigscreenPage[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const list = await engineRequest<BigscreenPagesList>(
				"/drag/page/list?pageNo=1&pageSize=50",
				undefined,
				{ method: "GET" },
			);
			setPages(list?.records ?? []);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setError(msg);
			setPages([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const create = useCallback(
		async (name: string, opts: Partial<{ style: "bigScreen" | "default"; theme: string; designType: number }> = {}) => {
			// 插件不再提供新建大屏入口，缺省落到普通看板（引擎仍支持两种 style）
			const style = opts.style ?? "default";
			const payload = {
				name,
				type: "0",
				theme: opts.theme ?? (style === "default" ? "default" : "dark"),
				style,
				backgroundImage: "",
				designType: opts.designType ?? 100,
				protectionCode: "",
			};
			const data = await engineRequest<{ id: string }>("/drag/page/add", payload);
			await refresh();
			return data.id;
		},
		[refresh],
	);

	const remove = useCallback(
		async (id: string) => {
			await engineRequest<boolean>(`/drag/page/physicalDelete?id=${encodeURIComponent(id)}`, undefined, { method: "DELETE" });
			await refresh();
		},
		[refresh],
	);

	const copy = useCallback(
		async (id: string) => {
			const data = await engineRequest<{ id: string }>(`/drag/page/copyPage?id=${encodeURIComponent(id)}`, undefined, { method: "GET" });
			await refresh();
			return data.id;
		},
		[refresh],
	);

	return { pages, loading, error, refresh, create, remove, copy };
}
