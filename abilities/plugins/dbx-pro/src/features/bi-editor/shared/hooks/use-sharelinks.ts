/**
 * use-sharelinks — 产物分享链接列表，接 /drag/sharelink/list。
 */
import { useCallback, useEffect, useState } from "react";
import { engineRequest } from "../../../../shared/services/engine-client";

export interface SharelinkItem {
	id: string;
	name?: string;
	type?: "permanent" | "timed";
	shortUrl?: string;
	remainingHours?: number;
	createTime?: string;
}

export function useSharelinks(): {
	sharelinks: SharelinkItem[];
	loading: boolean;
	refresh: () => void;
} {
	const [sharelinks, setSharelinks] = useState<SharelinkItem[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const data = await engineRequest<SharelinkItem[]>(`/drag/sharelink/list`, undefined, { method: "GET" });
			setSharelinks(Array.isArray(data) ? data : []);
		} catch { setSharelinks([]); }
		finally { setLoading(false); }
	}, []);

	useEffect(() => { void load(); }, [load]);

	return { sharelinks, loading, refresh: load };
}
