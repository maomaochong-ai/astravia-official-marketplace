/**
 * 虚拟地址 ↔ 文件偏移的映射。
 *
 * 深层分析全程按文件偏移工作（解码器就是这么实现的），但符号表、导出表和入口点
 * 的地址语义各不相同：ELF / Mach-O 给虚拟地址，PE 给 RVA。这一层把三者的差异
 * 收在一个地方，上层只调 `vaddrToOffset`，不需要知道样本是什么格式。
 */

import type { NativeFacts, NativeFormat } from "./types";

export interface ImageSegment {
	/** 段在地址空间里的起始地址（PE 为 RVA）。 */
	vaddr: number;
	/** 段内容在文件里的起始偏移。 */
	offset: number;
	size: number;
	executable: boolean;
	writable: boolean;
}

export interface AddressMap {
	format: NativeFormat;
	arch: string;
	bits: 32 | 64;
	segments: ImageSegment[];
	entryOffset: number | null;
	/** 可执行的文件偏移区间，已合并重叠、按起点排序。 */
	executable: Array<{ start: number; end: number }>;
	/** 映射不完整时的说明（缺 offset/vaddr 的节已被跳过）。 */
	warnings: string[];
}

function mergeRanges(ranges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
	const sorted = ranges.filter(range => range.end > range.start).sort((left, right) => left.start - right.start);
	const merged: Array<{ start: number; end: number }> = [];
	for (const range of sorted) {
		const last = merged[merged.length - 1];
		if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
		else merged.push({ ...range });
	}
	return merged;
}

export function addressMapFor(facts: NativeFacts): AddressMap {
	const segments: ImageSegment[] = [];
	const warnings: string[] = [];

	for (const section of facts.sections) {
		if (section.offset === undefined || section.vaddr === undefined) continue;
		if (section.size <= 0) continue;
		segments.push({
			vaddr: section.vaddr,
			offset: section.offset,
			size: section.size,
			executable: section.executable,
			writable: section.writable,
		});
	}

	if (segments.length === 0 && facts.sections.length > 0) {
		warnings.push("no section carried both a file offset and an address; vaddr↔offset 换算不可用");
	}

	const executable = mergeRanges(segments.filter(segment => segment.executable).map(segment => ({ start: segment.offset, end: segment.offset + segment.size })));

	return {
		format: facts.format,
		arch: facts.arch,
		bits: facts.bits,
		segments,
		entryOffset: facts.entryOffset ?? null,
		executable,
		warnings,
	};
}

export function vaddrToOffset(map: AddressMap, vaddr: number): number | null {
	for (const segment of map.segments) {
		if (vaddr >= segment.vaddr && vaddr < segment.vaddr + segment.size) return segment.offset + (vaddr - segment.vaddr);
	}
	return null;
}

export function offsetToVaddr(map: AddressMap, offset: number): number | null {
	for (const segment of map.segments) {
		if (offset >= segment.offset && offset < segment.offset + segment.size) return segment.vaddr + (offset - segment.offset);
	}
	return null;
}

/** `offset` 是否落在一个可执行区间里。 */
export function isExecutableOffset(map: AddressMap, offset: number): boolean {
	return map.executable.some(range => offset >= range.start && offset < range.end);
}

/** `offset` 落在哪个可执行区间的末尾（用于把函数体限制在所在区间内）。 */
export function executableRangeAt(map: AddressMap, offset: number): { start: number; end: number } | null {
	return map.executable.find(range => offset >= range.start && offset < range.end) ?? null;
}
