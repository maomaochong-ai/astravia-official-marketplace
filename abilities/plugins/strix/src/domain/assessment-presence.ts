/**
 * Does the bridge already hold an assessment?
 *
 * The panel can mount long after the run started: the user opens the tab from the
 * activity bar, or the host conversation drives the sandbox for a while before anyone
 * looks at the console. A panel that paints the launch column in that situation reads as
 * "nothing happened" while findings are being filed behind it — exactly the report that
 * "the panel does not follow the host conversation".
 *
 * So the screen is decided by state the service owns, not by whether this component
 * happened to be mounted: a live sandbox, a filed finding, a plan item, a note, a
 * coverage row or a threat model all mean the assessment is open.
 *
 * Kept pure and payload-agnostic so it can be tested without the service.
 */

export interface AssessmentPresenceProbe {
	readonly sandbox?: { readonly running?: boolean } | null;
	readonly findings?: readonly unknown[] | null;
	readonly todos?: readonly unknown[] | null;
	readonly notes?: readonly unknown[] | null;
	readonly coverage?: readonly unknown[] | null;
	readonly threatModel?: { readonly content?: string | null } | null;
}

function nonEmpty(value: readonly unknown[] | null | undefined): boolean {
	return Array.isArray(value) && value.length > 0;
}

export function hasOpenAssessment(state: AssessmentPresenceProbe | undefined | null): boolean {
	if (!state) return false;
	if (state.sandbox?.running === true) return true;
	if (nonEmpty(state.findings) || nonEmpty(state.todos)) return true;
	if (nonEmpty(state.notes) || nonEmpty(state.coverage)) return true;
	const threat = state.threatModel?.content;
	return typeof threat === "string" && threat.trim().length > 0;
}
