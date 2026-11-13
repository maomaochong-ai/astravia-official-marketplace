/**
 * What a scan mode actually changes.
 *
 * ADR strix-0002 gave the session a depth (`quick` / `standard` / `deep` / `diff`).
 * A depth that only changes a timeout is a label, not a mode: `deep` has to hold the
 * run to a higher standard before it may call itself finished, otherwise the report
 * reads the same as `quick` while the user waited longer.
 *
 * Kept as pure functions so the rules can be asserted without a sandbox, a container
 * or a model call.
 */

export type ScanMode = "quick" | "standard" | "deep" | "diff";

export const SCAN_MODES: readonly ScanMode[] = ["quick", "standard", "deep", "diff"];

export function asScanMode(value: unknown): ScanMode {
	return SCAN_MODES.includes(value as ScanMode) ? (value as ScanMode) : "standard";
}

/** Ceiling for one command, in seconds. `quick` must not sit ten minutes on one step. */
export function commandCapSeconds(mode: ScanMode): number {
	return mode === "quick" ? 120 : 600;
}

export interface CoverageLike {
	readonly surface: string;
	readonly outcome: string;
}

export interface FinishGate {
	readonly allowed: boolean;
	/** Why finishing was refused, written for the model to act on. */
	readonly reason?: string;
}

/**
 * `deep` may not finish while a surface was only skipped, and may not finish before
 * anything was recorded at all. `standard` and `quick` finish freely — refusing there
 * would turn a deliberate shallow pass into a stuck one.
 *
 * `diff` only tests what changed, so "few entries" is expected; it is judged like
 * `standard`.
 */
export function finishGate(mode: ScanMode, coverage: readonly CoverageLike[]): FinishGate {
	if (mode !== "deep") return { allowed: true };

	if (coverage.length === 0) {
		return {
			allowed: false,
			reason:
				"deep scan: nothing has been recorded in coverage yet. Record at least one surface with strix_coverage_record (outcome vulnerable / clean / skipped) before finishing.",
		};
	}

	const skipped = [...new Set(coverage.filter((entry) => entry.outcome === "skipped").map((entry) => entry.surface))];
	if (skipped.length > 0) {
		return {
			allowed: false,
			reason:
				`deep scan: these surfaces were recorded as skipped — ${skipped.slice(0, 8).join(", ")}` +
				`${skipped.length > 8 ? ` (+${skipped.length - 8} more)` : ""}. ` +
				"Either test them and record the outcome, or say in the summary why they stay untested.",
		};
	}

	return { allowed: true };
}

/** The line the run log shows when a mode is chosen. */
export function describeMode(mode: ScanMode): string {
	switch (mode) {
		case "quick":
			return "quick: bounded first pass, 120s per command";
		case "deep":
			return "deep: full sweep, coverage gate before finishing";
		case "diff":
			return "diff: only the changes in the mounted repository";
		default:
			return "standard: full sweep";
	}
}
