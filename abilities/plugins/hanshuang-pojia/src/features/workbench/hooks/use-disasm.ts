import { useTranslation } from "@astravia-org/plugin-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deepAnalyse, functionBoundFor, listFunctionCandidates, type DeepMode, type DeepResult, type FunctionCandidate } from "../../../domain/native/deep";
import { disasmArchFor, type DisasmArch } from "../../../domain/native/insn";
import type { AddressMap } from "../../../domain/native/image";
import { listSymbols } from "../../../domain/native/symbols";
import type { NativeFacts } from "../../../domain/native/types";
import { buildXrefIndex, type XrefIndex } from "../../../domain/native/xref";
import type { WorkbenchBridge } from "../bridge";

export type DisasmUnsupported = "no-sample" | "no-facts" | "arch";

export interface DisasmRequest {
	bytes: Uint8Array | null;
	facts: NativeFacts | null;
	map: AddressMap | null;
	bridge: WorkbenchBridge;
	/** 只有反汇编页真的打开时才建全局索引，避免每次分诊都扫全库。 */
	enabled: boolean;
}

export interface DisasmModel {
	supported: boolean;
	/** 不支持时的原因；i18n key 由页面决定文案。 */
	unsupported: DisasmUnsupported | null;
	arch: DisasmArch | null;
	indexing: boolean;
	candidates: FunctionCandidate[];
	selected: number | null;
	select(offset: number | null): void;
	mode: DeepMode;
	setMode(mode: DeepMode): void;
	budget: number;
	setBudget(value: number): void;
	result: DeepResult | null;
	copy(): void;
}

const DEFAULT_MODE: DeepMode = "branch";
const DEFAULT_BUDGET = 6000;
const MIN_BUDGET = 500;
const MAX_BUDGET = 60_000;
/** 页面一次能列出的函数上限；再多也没人翻。 */
const MAX_LISTED_FUNCTIONS = 400;

/**
 * 深层反汇编的状态机：候选函数 → 选中 → 三档渲染。
 *
 * 全部在渲染进程里算：样本字节本来就在面板手里，多一次 IPC 只是多一次失败点。
 */
export function useDisasm(request: DisasmRequest): DisasmModel {
	const { t } = useTranslation();
	const { bytes, facts, map, bridge, enabled } = request;

	const arch = useMemo(() => (facts ? disasmArchFor(facts.arch) : null), [facts]);
	const decodable = arch !== null && arch !== "unknown";
	const supported = bytes !== null && facts !== null && map !== null && decodable;

	const [mode, setMode] = useState<DeepMode>(DEFAULT_MODE);
	const [budget, setBudget] = useState(DEFAULT_BUDGET);
	const [selected, setSelected] = useState<number | null>(null);
	const [index, setIndex] = useState<XrefIndex | null>(null);
	const [indexing, setIndexing] = useState(false);
	// 候选表变了（索引建完）就补选一次，否则页面会停在空输出。
	const autoSelected = useRef<number | null>(null);

	// 换样本就重新开始：旧的偏移在新文件里没有意义。
	const sampleKey = bytes;
	useEffect(() => {
		setSelected(null);
		setIndex(null);
		// 自动补选也要忘掉上一个样本的入口偏移，否则新样本首屏是空的。
		autoSelected.current = null;
	}, [sampleKey]);

	useEffect(() => {
		if (!enabled || !supported || !bytes || !arch || !map) return;
		let cancelled = false;
		setIndexing(true);
		// 让出一帧再扫，页面先画出来，链接过程不至于让首次渲染卡住。
		const timer = setTimeout(() => {
			const built = buildXrefIndex(bytes, arch, map.executable);
			if (cancelled) return;
			setIndex(built);
			setIndexing(false);
		}, 0);
		return () => {
			cancelled = true;
			clearTimeout(timer);
			setIndexing(false);
		};
	}, [arch, bytes, enabled, map, supported]);

	const candidates = useMemo<FunctionCandidate[]>(() => {
		if (!bytes || !facts || !map) return [];
		const symbols = listSymbols(bytes, facts.format, { limit: MAX_LISTED_FUNCTIONS });
		return listFunctionCandidates(bytes, facts, symbols.symbols, map, index ?? undefined, MAX_LISTED_FUNCTIONS);
	}, [bytes, facts, index, map]);

	useEffect(() => {
		if (selected !== null) return;
		const first = candidates[0];
		if (!first) return;
		if (autoSelected.current === first.offset) return;
		autoSelected.current = first.offset;
		setSelected(first.offset);
	}, [candidates, selected]);

	const result = useMemo<DeepResult | null>(() => {
		if (!bytes || !arch || arch === "unknown" || selected === null || !map) return null;
		const candidate = candidates.find(item => item.offset === selected);
		const end = functionBoundFor(selected, candidates, map);
		// 带上段表：同一段输出里同时给出文件偏移与虚拟地址，方便和 IDA / Ghidra 对照。
		return deepAnalyse(bytes, arch, { start: selected, end, name: candidate?.name ?? undefined }, { mode, budget, index: index ?? undefined, map });
	}, [arch, budget, bytes, candidates, index, map, mode, selected]);

	const select = useCallback((offset: number | null) => setSelected(offset), []);

	const copy = useCallback(() => {
		if (!result) return;
		navigator.clipboard?.writeText(result.text).then(
			() => bridge.notify(t("panel.action.copied"), "success"),
			() => bridge.notify(t("panel.action.copyFailed"), "error"),
		);
	}, [bridge, result, t]);

	const unsupported: DisasmUnsupported | null = bytes === null ? "no-sample" : facts === null || map === null ? "no-facts" : decodable ? null : "arch";

	return { supported, unsupported, arch: arch === "unknown" ? null : arch, indexing, candidates, selected, select, mode, setMode, budget, setBudget, result, copy };
}

export { DEFAULT_BUDGET as DISASM_DEFAULT_BUDGET, MAX_BUDGET as DISASM_MAX_BUDGET, MIN_BUDGET as DISASM_MIN_BUDGET };
