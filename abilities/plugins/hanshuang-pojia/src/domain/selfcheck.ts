/**
 * 面板「自检」页的引擎部分。
 *
 * 每一项都是对打包进插件的真实实现做一次最小断言：结果来自运行结果，
 * 不是静态清单。宿主能力（文件读写、私有存储、对话）由面板侧另外汇总。
 */

import { looksLikeDex } from "./android/dex";
import { sha256Hex } from "./digest";
import { shannonEntropy } from "./entropy";
import { looksLikeElf } from "./native/elf";
import { looksLikeMacho } from "./native/macho";
import { looksLikePe } from "./native/pe";
import { buildReport } from "./report/report";
import { extractStrings } from "./strings";

export type SelfCheckStatus = "pass" | "warn" | "fail";

export interface SelfCheckItem {
	id: string;
	status: SelfCheckStatus;
	/** 一句英文结论，UI 只负责排版。 */
	detail: string;
}

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function run(id: string, body: () => { status: SelfCheckStatus; detail: string }): SelfCheckItem {
	try {
		return { id, ...body() };
	} catch (error) {
		return { id, status: "fail", detail: error instanceof Error ? error.message : String(error) };
	}
}

function asciiBytes(value: string): Uint8Array {
	return new TextEncoder().encode(value);
}

function magic(prefix: readonly number[], size = 64): Uint8Array {
	const bytes = new Uint8Array(size);
	bytes.set(prefix, 0);
	return bytes;
}

/**
 * PE 不是「MZ 开头」就够：解析器要求 e_lfanew 指向 `PE\0\0`。
 * 自检必须给一个真能被认下的最小头，否则它报的 FAIL 是夹具的问题，不是产品的。
 */
function peFixture(): Uint8Array {
	const bytes = new Uint8Array(0x48);
	bytes[0] = 0x4d;
	bytes[1] = 0x5a;
	bytes[0x3c] = 0x40;
	bytes.set([0x50, 0x45, 0x00, 0x00], 0x40);
	return bytes;
}

/** 逐项跑一遍编码器；任何一项抛错都会以 fail 呈现，而不是让整页空白。 */
export function runEngineSelfCheck(): SelfCheckItem[] {
	return [
		run("digest", () => {
			const empty = sha256Hex(new Uint8Array(0));
			return empty === EMPTY_SHA256
				? { status: "pass", detail: "SHA-256 matches the published digest for empty input." }
				: { status: "fail", detail: `SHA-256 of empty input is ${empty.slice(0, 16)}…` };
		}),
		run("entropy", () => {
			const flat = shannonEntropy(new Uint8Array(4096));
			const ramp = shannonEntropy(Uint8Array.from({ length: 256 }, (_, index) => index));
			return Math.abs(flat) < 0.0001 && Math.abs(ramp - 8) < 0.0001
				? { status: "pass", detail: "Entropy reads 0.00 for a constant block and 8.00 for a full byte ramp." }
				: { status: "fail", detail: `Entropy read ${flat.toFixed(3)} / ${ramp.toFixed(3)} instead of 0 / 8.` };
		}),
		run("strings", () => {
			const hits = extractStrings(asciiBytes("alpha\u0000beta\u0000"), { encodings: ["ascii"], minLength: 4 });
			return hits.length === 2 && hits[0]!.value === "alpha" && hits[1]!.offset === 6
				? { status: "pass", detail: "Two ASCII strings were extracted with byte-accurate offsets." }
				: { status: "fail", detail: `Extracted ${hits.length} string(s) from a two-string fixture.` };
		}),
		run("detect", () => {
			const elf = looksLikeElf(magic([0x7f, 0x45, 0x4c, 0x46]));
			const pe = looksLikePe(peFixture());
			const macho = looksLikeMacho(magic([0xcf, 0xfa, 0xed, 0xfe]));
			const dex = looksLikeDex(magic([0x64, 0x65, 0x78, 0x0a, 0x30, 0x33, 0x35, 0x00], 0x70));
			return elf && pe && macho && dex
				? { status: "pass", detail: "ELF, PE, Mach-O and DEX magic all resolve to their parser." }
				: { status: "fail", detail: `Magic detection: elf ${elf}, pe ${pe}, macho ${macho}, dex ${dex}.` };
		}),
		run("report", () => {
			const report = buildReport({
				mode: "summary",
				target: {
					path: "/selfcheck.bin",
					name: "selfcheck.bin",
					size: 1,
					sha256: EMPTY_SHA256,
					format: "unknown",
					formatLabel: "Unrecognised binary",
					generatedAt: "1970-01-01T00:00:00.000Z",
				},
				findings: [{ ruleId: "apk.debuggable", severity: "high", title: "Application is debuggable", detail: "", evidence: [] }],
				facts: [],
				sections: [],
				limits: [],
				summary: [],
			});
			return report.risk.score === 22 && report.risk.grade === "B"
				? { status: "pass", detail: "One high finding scores 22 / grade B through the weighted rubric." }
				: { status: "fail", detail: `Score rubric returned ${report.risk.score} / grade ${report.risk.grade}.` };
		}),
	];
}
