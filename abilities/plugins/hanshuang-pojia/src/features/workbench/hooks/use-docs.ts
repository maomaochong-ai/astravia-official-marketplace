import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import {
	loadDocsLibrary,
	type DocEntry,
	type DocGroup,
	type DocHit,
	type DocsLibrary,
	type DocTotals,
} from "../services/docs";
import type { WorkbenchBridge } from "../bridge";

export type DocSearchMode = "title" | "full";

export interface DocsModel {
	/** 索引尚未到达时为 false：此时 groups 为空、totals 为零，不是「没有文档」。 */
	ready: boolean;
	groups: DocGroup[];
	totals: DocTotals;
	query: string;
	setQuery(value: string): void;
	mode: DocSearchMode;
	setMode(mode: DocSearchMode): void;
	/** null 表示没在检索；空数组表示检索过但没有命中。 */
	hits: DocHit[] | null;
	searching: boolean;
	selected: DocEntry | null;
	/** 按 id 取条目：弹窗按 id 打开，不必依赖当前选中项。 */
	byId(id: string): DocEntry | null;
	/** 直接读一篇正文（导出等场景用；不改选中态）。 */
	readDocument(id: string): Promise<string>;
	select(id: string | null): void;
	body: string | null;
	loading: boolean;
	error: string | null;
	/** 窄面板下单列时目录是否可见；宽面板由 CSS 强制双列，不看这个值。 */
	listOpen: boolean;
	showList(): void;
	copyPath(): void;
}

const DEFAULT_DOC = "kb/README";

const EMPTY_TOTALS: DocTotals = { documents: 0, assets: 0, bytes: 0, lines: 0, byGroup: {} };

/** 打开文档页时给谁一个默认正文：索引里有的那篇根文档，避免首屏空着。 */
function initialDoc(library: DocsLibrary): DocEntry | null {
	return library.byId(DEFAULT_DOC) ?? library.entries[0] ?? null;
}

export function useDocs(bridge: WorkbenchBridge, enabled: boolean): DocsModel {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const [mode, setMode] = useState<DocSearchMode>("full");
	const [fullHits, setFullHits] = useState<DocHit[] | null>(null);
	const [searching, setSearching] = useState(false);
	const [selected, setSelected] = useState<DocEntry | null>(null);
	const [listOpen, setListOpen] = useState(true);
	const [body, setBody] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [library, setLibrary] = useState<DocsLibrary | null>(null);

	// 索引按需加载（ADR 0009 D5）：没进文档页就一个字节都不读。
	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;
		void loadDocsLibrary().then(
			next => {
				if (cancelled) return;
				setLibrary(next);
				setSelected(current => current ?? initialDoc(next));
			},
			(reason: unknown) => {
				if (cancelled) return;
				setError(reason instanceof Error ? reason.message : String(reason));
			},
		);
		return () => {
			cancelled = true;
		};
	}, [enabled]);

	const needle = query.trim();
	const titleHits = useMemo(
		() => (needle && mode === "title" && library ? library.searchTitles(needle) : null),
		[library, needle, mode],
	);

	useEffect(() => {
		if (mode !== "full" || needle.length < 2 || !library) {
			setFullHits(null);
			setSearching(false);
			return;
		}
		let cancelled = false;
		setSearching(true);
		const timer = setTimeout(() => {
			void library.searchFullText(needle).then(
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
	}, [library, needle, mode]);

	const selectedId = selected?.id ?? null;

	useEffect(() => {
		if (!selectedId || !library) {
			setBody(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		void library.loadBody(selectedId).then(
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
	}, [library, selectedId]);

	const select = useCallback(
		(id: string | null) => {
			if (id === null) {
				setSelected(null);
				return;
			}
			const entry = library?.byId(id);
			if (entry) {
				setSelected(entry);
				// 窄面板里正文与目录是二选一，点完就切到正文；宽面板不受影响。
				setListOpen(false);
			}
		},
		[library],
	);

	const showList = useCallback(() => setListOpen(true), []);

	const copyPath = useCallback(() => {
		if (!selected) return;
		navigator.clipboard?.writeText(selected.path).then(
			() => bridge.notify(t("panel.action.copied"), "success"),
			() => bridge.notify(t("panel.action.copyFailed"), "error"),
		);
	}, [bridge, selected, t]);

	const groups = useMemo(() => library?.groups() ?? [], [library]);

	return {
		ready: library !== null,
		groups,
		totals: library?.totals ?? EMPTY_TOTALS,
		query,
		setQuery,
		mode,
		setMode,
		hits: mode === "title" ? titleHits : fullHits,
		searching,
		selected,
		byId: id => library?.byId(id) ?? null,
		readDocument: id => (library ? library.loadBody(id) : Promise.reject(new Error("docs index not loaded"))),
		select,
		body,
		loading,
		error,
		copyPath,
		listOpen,
		showList,
	};
}
