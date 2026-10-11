/**
 * use-worktree-status — 工作树发布状态，接 /drag/worktree/status + /drag/worktree/publish。
 */
import { useCallback, useEffect, useState } from "react";
import { engineRequest } from "../../../shared/services/engine-client";

export function useWorktreeStatus(): {
	dirty: boolean;
	updateCount: number;
	publishedCount: number;
	publish: () => Promise<void>;
	refresh: () => void;
} {
	const [updateCount, setUpdateCount] = useState(0);
	const [publishedCount, setPublishedCount] = useState(0);
	const dirty = updateCount > publishedCount;

	const refresh = useCallback(async () => {
		try {
			const data = await engineRequest<{ updateCount?: number; publishedCount?: number }>(`/drag/worktree/status`, undefined, { method: "GET" });
			setUpdateCount(data?.updateCount ?? 0);
			setPublishedCount(data?.publishedCount ?? 0);
		} catch { /* ignore */ }
	}, []);

	const publish = useCallback(async () => {
		try {
			await engineRequest(`/drag/worktree/publish`, undefined, { method: "POST" });
			await refresh();
		} catch { /* ignore */ }
	}, [refresh]);

	useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, []);

	return { dirty, updateCount, publishedCount, publish, refresh };
}
