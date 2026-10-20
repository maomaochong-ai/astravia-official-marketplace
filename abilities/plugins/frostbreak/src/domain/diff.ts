/**
 * Byte-level comparison of two samples of the same family (an old and a new
 * build of an installer, two builds of a library). It answers "what actually
 * changed" without running a diff tool: aligned runs of equal bytes collapse,
 * changed runs are reported with both sides in hex, and a size change is
 * stated explicitly instead of being folded into the hunks.
 */

export interface DiffHunk {
	offset: number;
	left: string;
	right: string;
	length: number;
}

export interface BinaryDiff {
	identical: boolean;
	leftSize: number;
	rightSize: number;
	sameSize: boolean;
	changedBytes: number;
	hunks: DiffHunk[];
	truncated: boolean;
}

const MAX_HEX_BYTES = 32;
const HUNK_GAP = 12;

function hexOf(bytes: Uint8Array, start: number, length: number): string {
	const parts: string[] = [];
	for (let index = 0; index < Math.min(length, MAX_HEX_BYTES); index += 1) {
		parts.push(bytes[start + index]!.toString(16).padStart(2, "0"));
	}
	if (length > MAX_HEX_BYTES) parts.push(`… (${length - MAX_HEX_BYTES} more)`);
	return parts.join(" ");
}

export function diffBytes(left: Uint8Array, right: Uint8Array, options: { maxHunks?: number } = {}): BinaryDiff {
	const maxHunks = Math.max(1, Math.min(500, options.maxHunks ?? 40));
	const common = Math.min(left.byteLength, right.byteLength);
	let changedBytes = Math.abs(left.byteLength - right.byteLength);
	let identical = left.byteLength === right.byteLength;

	for (let index = 0; index < common; index += 1) {
		if (left[index] !== right[index]) {
			changedBytes += 1;
			identical = false;
		}
	}

	const hunks: DiffHunk[] = [];
	let truncated = false;
	if (!identical) {
		let index = 0;
		while (index < common) {
			if (left[index] === right[index]) {
				index += 1;
				continue;
			}
			const start = index;
			let lastDifference = index;
			while (index < common && index - lastDifference <= HUNK_GAP) {
				if (left[index] !== right[index]) lastDifference = index;
				index += 1;
			}
			const end = Math.min(common, lastDifference + 1);
			if (hunks.length >= maxHunks) {
				truncated = true;
				break;
			}
			hunks.push({
				offset: start,
				length: end - start,
				left: hexOf(left, start, end - start),
				right: hexOf(right, start, end - start),
			});
			index = end;
		}
	}

	return {
		identical,
		leftSize: left.byteLength,
		rightSize: right.byteLength,
		sameSize: left.byteLength === right.byteLength,
		changedBytes,
		hunks,
		truncated,
	};
}
