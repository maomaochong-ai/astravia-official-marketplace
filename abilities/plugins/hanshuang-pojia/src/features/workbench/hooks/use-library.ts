import { useCallback, useEffect, useRef, useState } from "react";
import type { TriageReport } from "../../../domain/report/report";
import type { WorkbenchBridge } from "../bridge";
import { DEFAULT_SETTINGS, entryFromReport, MAX_LIBRARY, type LibraryEntry, type WorkbenchSettings } from "../state";

export interface LibraryModel {
	settings: WorkbenchSettings;
	entries: LibraryEntry[];
	/** 本次会话里分析过的完整报告，按 library id 索引；对比页只读这里。 */
	reports: Record<string, TriageReport>;
	/** 宿主私有存储可用时 true：设置与样本库跨会话保留。 */
	persisted: boolean;
	/** 已从存储读回初值，避免首帧把默认设置写回去。 */
	loaded: boolean;
	updateSettings(patch: Partial<WorkbenchSettings>): void;
	remember(report: TriageReport): LibraryEntry;
	clearLibrary(): void;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}

/** 读回来的设置可能来自旧版本或手改过的文件，逐字段兜底。 */
export function normalizeSettings(input: WorkbenchSettings | null | undefined): WorkbenchSettings {
	if (!input) return { ...DEFAULT_SETTINGS };
	return {
		mode: input.mode === "full" ? "full" : "summary",
		disabledRules: Array.isArray(input.disabledRules) ? input.disabledRules.filter(rule => typeof rule === "string").slice(0, 200) : [],
		stringsMinLength: clamp(input.stringsMinLength, 4, 24, DEFAULT_SETTINGS.stringsMinLength),
		stringsLimit: clamp(input.stringsLimit, 50, 2000, DEFAULT_SETTINGS.stringsLimit),
		entropyBuckets: clamp(input.entropyBuckets, 8, 60, DEFAULT_SETTINGS.entropyBuckets),
		persistLibrary: input.persistLibrary !== false,
	};
}

/** 设置都是平铺值，逐字段比较比引用比较可靠：归一化恒返新对象，靠引用会让同值也算变。 */
function sameSettings(a: WorkbenchSettings, b: WorkbenchSettings): boolean {
	return (
		a.mode === b.mode &&
		a.stringsMinLength === b.stringsMinLength &&
		a.stringsLimit === b.stringsLimit &&
		a.entropyBuckets === b.entropyBuckets &&
		a.persistLibrary === b.persistLibrary &&
		a.disabledRules.length === b.disabledRules.length &&
		a.disabledRules.every((rule, index) => rule === b.disabledRules[index])
	);
}

/** 同一批条目（同 id 同序）就不换新数组，避免下游 memo 白跑。 */
function sameEntries(a: readonly LibraryEntry[], b: readonly LibraryEntry[]): boolean {
	return a.length === b.length && a.every((entry, index) => entry.id === b[index]?.id);
}

function normalizeEntry(value: LibraryEntry): LibraryEntry | null {
	if (!value || typeof value.id !== "string" || typeof value.path !== "string") return null;
	if (typeof value.score !== "number" || typeof value.sha256 !== "string") return null;
	return value;
}

export function useLibrary(bridge: WorkbenchBridge): LibraryModel {
	const [settings, setSettings] = useState<WorkbenchSettings>(DEFAULT_SETTINGS);
	const [entries, setEntries] = useState<LibraryEntry[]>([]);
	const [reports, setReports] = useState<Record<string, TriageReport>>({});
	const [persisted, setPersisted] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const firstWrite = useRef(true);
	/** 上一次写盘的参数签名：只换了引用、值没变时不再重复写。 */
	const lastWrite = useRef<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		Promise.all([bridge.settings(), bridge.library()])
			.then(([storedSettings, storedLibrary]) => {
				if (cancelled) return;
				setSettings(current => {
					const next = normalizeSettings(storedSettings);
					// 同值不换引用：归一化恒返新对象，直接 setState 会让依赖 settings 的 effect 成环。
					return sameSettings(current, next) ? current : next;
				});
				if (storedLibrary) {
					setEntries(current => {
						const next = storedLibrary
							.map(normalizeEntry)
							.filter((entry): entry is LibraryEntry => entry !== null)
							.slice(0, MAX_LIBRARY);
						return sameEntries(current, next) ? current : next;
					});
					setPersisted(true);
				}
			})
			.catch(() => {
				// 没有 storage 权限时保持默认设置；面板照常可用，只是不跨会话。
			})
			.finally(() => {
				if (!cancelled) setLoaded(true);
			});
		return () => {
			cancelled = true;
		};
	}, [bridge]);

	useEffect(() => {
		if (!loaded) return;
		if (firstWrite.current) {
			firstWrite.current = false;
			return;
		}
		const signature = JSON.stringify([settings, settings.persistLibrary ? entries : null]);
		if (signature === lastWrite.current) return;
		lastWrite.current = signature;
		Promise.all([bridge.saveSettings(settings), settings.persistLibrary ? bridge.saveLibrary(entries) : Promise.resolve(true)])
			.then(([settingsSaved, librarySaved]) => setPersisted(settingsSaved && librarySaved))
			.catch(() => setPersisted(false));
	}, [bridge, entries, loaded, settings]);

	const updateSettings = useCallback((patch: Partial<WorkbenchSettings>) => {
		setSettings(current => normalizeSettings({ ...current, ...patch }));
	}, []);

	const remember = useCallback((report: TriageReport): LibraryEntry => {
		const entry = entryFromReport(report);
		setReports(current => ({ ...current, [entry.id]: report }));
		setEntries(current => [entry, ...current.filter(item => item.id !== entry.id)].slice(0, MAX_LIBRARY));
		return entry;
	}, []);

	const clearLibrary = useCallback(() => {
		setEntries([]);
		setReports({});
	}, []);

	return { settings, entries, reports, persisted, loaded, updateSettings, remember, clearLibrary };
}
