/**
 * use-runlogs — 最近运行日志列表，接 /drag/runlog/list。
 */
import { useCallback, useEffect, useState } from "react";
import { engineRequest } from "../../../../shared/services/engine-client";

export interface RunLogItem {
	id: string;
	name?: string;
	detail?: string;
	duration?: number;
	success?: boolean;
	createTime?: string;
}

export function useRunlogs(opts: { limit?: number } = {}): {
	runlogs: RunLogItem[];
	loading: boolean;
	refresh: () => void;
} {
	const [runlogs, setRunlogs] = useState<RunLogItem[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const data = await engineRequest<RunLogItem[]>(`/drag/runlog/list?limit=${opts.limit ?? 4}`, undefined, { method: "GET" });
			setRunlogs(Array.isArray(data) ? data : []);
		} catch { setRunlogs([]); }
		finally { setLoading(false); }
	}, [opts.limit]);

	useEffect(() => { void load(); }, [load]);

	return { runlogs, loading, refresh: load };
}
