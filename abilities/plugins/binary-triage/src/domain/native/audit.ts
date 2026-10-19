import { finding, type Finding } from "../audit/findings";
import { indexOfAscii } from "../bytes";
import { entropyOfRange } from "../entropy";
import type { NativeFacts } from "./types";

const PACKED_ENTROPY = 7.2;
const PACKED_MIN_SIZE = 16 * 1024;

function formatCount(value: number): string {
	return value.toLocaleString("en-US");
}

export function auditNative(facts: NativeFacts, bytes: Uint8Array): Finding[] {
	const findings: Finding[] = [];
	const rwx = facts.sections.filter(section => section.executable && section.writable && section.size > 0);
	if (rwx.length > 0) {
		findings.push(
			finding(
				"native.rwx-segment",
				`${rwx.length} section(s) are both writable and executable.`,
				rwx.slice(0, 4).map(section => `${section.name} (${formatCount(section.size)} bytes)`),
			),
		);
	}

	if (facts.executableStack === true) {
		findings.push(finding("native.executable-stack", "The image requests an executable stack."));
	}
	if (facts.pie === false) {
		findings.push(finding("native.no-pie", "The image is not position independent."));
	}
	if (facts.nxCompat === false) {
		findings.push(finding("native.no-nx", "DllCharacteristics does not set NX_COMPAT."));
	}

	const imports = facts.imports.reduce((sum, group) => sum + group.functions.length, 0);
	const maxEntropy = facts.sections.reduce((max, section) => Math.max(max, section.entropy), 0);
	const upxOffset = indexOfAscii(bytes, "UPX!");
	const packed = upxOffset >= 0 || (maxEntropy >= PACKED_ENTROPY && imports === 0 && bytes.byteLength >= PACKED_MIN_SIZE);
	if (packed) {
		findings.push(
			finding(
				"native.packed",
				upxOffset >= 0 ? "The UPX marker is present in the image." : `Highest section entropy is ${maxEntropy.toFixed(2)} with no resolvable imports.`,
				upxOffset >= 0 ? [`UPX! at offset 0x${upxOffset.toString(16)}`] : [`entropy ${maxEntropy.toFixed(2)}`],
			),
		);
	}

	if (facts.stripped === false) {
		findings.push(finding("native.debug-symbols", "A symbol table survived the build, so function names are readable."));
	}
	if (facts.format === "elf" && facts.kind === "executable" && facts.interpreter === null) {
		findings.push(finding("native.statically-linked", "No PT_INTERP segment: the binary carries its own runtime."));
	}
	if (facts.dotnet) {
		findings.push(finding("native.dotnet", "The CLR data directory is populated."));
	}
	if (facts.signed === true) {
		findings.push(finding("native.authenticode", "A security directory is present in the PE optional header."));
	}

	return findings;
}

/** 供报告使用：把体积最大的几个段按熵排序，指出可能的载荷位置。 */
export function hottestSections(facts: NativeFacts, limit = 5): { name: string; size: number; entropy: number }[] {
	return [...facts.sections]
		.filter(section => section.size >= 1024)
		.sort((left, right) => right.entropy - left.entropy)
		.slice(0, limit)
		.map(section => ({ name: section.name, size: section.size, entropy: section.entropy }));
}

export function overallEntropy(bytes: Uint8Array): number {
	return entropyOfRange(bytes, 0, bytes.byteLength, 1024 * 1024);
}
