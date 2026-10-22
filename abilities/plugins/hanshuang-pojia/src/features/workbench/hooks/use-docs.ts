import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { docById, docGroups, DOC_ENTRIES, DOC_TOTALS, loadDoc, searchFullText, searchTitles, type DocEntry, type DocHit } from "../services/docs";
import type { WorkbenchBridge } from "../bridge";

export type DocSearchMode = "title" | "full";

export interface DocsModel {
	groups: ReturnType<typeof docGroups>;
	totals: typeof DOC_TOTALS;
	query: string;
	setQuery(value: string): void;
	mode: DocSearchMode;
	setMode(mode: DocSearchMode): void;
	/** null 表示没在检索；空数组表示检索过但没有命中。 */
	hits: DocHit[] | null;
	searching: boolean;
	selected: DocEntry | null;
	select(id: string | null): void;
	body: string | null;
	loading: boolean;
	error: string | null;
	copyPath(): void;
}

const DEFAULT_DOC = "kb/README";

/** 打开文档页时给谁一个默认正文：索引里有的第一篇，避免首屏空着。 */
function initialDoc(): DocEntry | null {
	return docById(DEFAULT_DOC) ?? DOC_ENTRIES[0] ?? null;
}

export function useDocs(bridge: WorkbenchBridge, enabled: boolean): DocsModel {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const [mode, setMode] = useState<DocSearchMode>("title");
	const [fullHits, setFullHits] = useState<DocHit[] | null>(null);
	const [searching, setSearching] = useState(false);
	const [selected, setSelected] = useState<DocEntry | null>(null);
	const [body, setBody] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 正文按需分块加载；没进文档页就一篇都不读。
	useEffect(() => {
		if (!enabled) return;
		setSelected(current => current ?? initialDoc());
	}, [enabled]);

	const needle = query.trim();
	const titleHits = useMemo(() => (needle && mode === "title" ? searchTitles(needle) : null), [needle, mode]);

	useEffect(() => {
		if (mode !== "full" || needle.length < 2) {
			setFullHits(null);
			setSearching(false);
			return;
		}
		let cancelled = false;
		setSearching(true);
		const timer = setTimeout(() => {
			void searchFullText(needle).then(
				hits => {
					if (cancelled) return;
					setFullHits(hits);
					setSearching(false);
				},
				() => {
					if (cancelled) return;
					setFullHits([]);
					setSearching(false);
				},
			);
		}, 250);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [needle, mode]);

	const selectedId = selected?.id ?? null;

	useEffect(() => {
		if (!selectedId) {
			setBody(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		void loadDoc(selectedId).then(
			text => {
				if (cancelled) return;
				setBody(text);
				setLoading(false);
			},
			(reason: unknown) => {
				if (cancelled) return;
				setBody(null);
				setError(reason instanceof Error ? reason.message : String(reason));
				setLoading(false);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [selectedId]);

	const select = useCallback((id: string | null) => {
		if (id === null) {
			setSelected(null);
			return;
		}
		const entry = docById(id);
		if (entry) setSelected(entry);
	}, []);

	const copyPath = useCallback(() => {
		if (!selected) return;
		navigator.clipboard?.writeText(selected.path).then(
			() => bridge.notify(t("panel.action.copied"), "success"),
			() => bridge.notify(t("panel.action.copyFailed"), "error"),
		);
	}, [bridge, selected, t]);

	return {
		groups: useMemo(() => docGroups(), []),
		totals: DOC_TOTALS,
		query,
		setQuery,
		mode,
		setMode,
		hits: mode === "title" ? titleHits : fullHits,
		searching,
		selected,
		select,
		body,
		loading,
		error,
		copyPath,
	};
}
