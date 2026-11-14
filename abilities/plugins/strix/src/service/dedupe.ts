/**
 * Duplicate findings: one weakness reported twice is a worse report, not a longer one.
 *
 * Upstream settles this with a model pass (`strix/report/dedupe.py`). Here the model is the
 * host agent, which already reads the ledger and can call `strix_merge_findings` itself
 * when it recognises a pair; the plugin no longer owns a model call to run a second pass.
 * What stays is the deterministic half — an exact match on (title, location) is not a
 * judgement call — plus the instruction text the agent is held to, so the rule can be
 * asserted without a model.
 */


export interface DedupeCandidate {
	readonly id: string;
	readonly title: string;
	readonly severity: string;
	readonly location: string;
	readonly description?: string;
	readonly evidence?: string;
}

export interface DedupeResult {
	/** Ids to merge into another finding. */
	readonly duplicates: ReadonlyArray<{ id: string; into: string; reason: string }>;
	/** True when the model was consulted; false when the deterministic pass settled it. */
	readonly usedModel: boolean;
}

function normalize(text: string | undefined): string {
	return (text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Same title at the same location: one finding, whichever payload showed it. */
export function exactDuplicates(candidates: readonly DedupeCandidate[]): DedupeResult {
	const seen = new Map<string, string>();
	const duplicates: Array<{ id: string; into: string; reason: string }> = [];
	for (const candidate of candidates) {
		const key = `${normalize(candidate.title)}@${normalize(candidate.location)}`;
		const first = seen.get(key);
		if (first === undefined) {
			seen.set(key, candidate.id);
			continue;
		}
		duplicates.push({ id: candidate.id, into: first, reason: "same title at the same location" });
	}
	return { duplicates, usedModel: false };
}

/** The prompt, kept here so the shape can be asserted without a model. */
export function dedupeInstruction(candidates: readonly DedupeCandidate[]): string {
	const rows = candidates.map((candidate) => ({
		id: candidate.id,
		title: candidate.title,
		severity: candidate.severity,
		location: candidate.location,
		description: (candidate.description ?? "").slice(0, 400),
		evidence: (candidate.evidence ?? "").slice(0, 400),
	}));
	return [
		"You are de-duplicating a penetration-test findings list.",
		"Two findings are duplicates when they describe the SAME root cause at the SAME sink,",
		"even if the payload, the URL or the wording differ. Different sinks stay separate",
		"even when the root cause is shared: the fix differs per site.",
		"Different vulnerabilities at one endpoint are NOT duplicates.",
		"",
		"Return only the pairs to merge, as JSON:",
		'{"duplicates":[{"id":"<duplicate id>","into":"<keep this id>","reason":"<one line>"}]}',
		'Return {"duplicates":[]} when nothing is a duplicate. Never invent an id.',
		"",
		"Findings:",
		JSON.stringify(rows, null, 2),
	].join("\n");
}

/** Read the model's answer defensively: an unparsable reply means "merge nothing". */
export function parseDedupeReply(reply: string, candidates: readonly DedupeCandidate[]): DedupeResult["duplicates"] {
	const known = new Set(candidates.map((candidate) => candidate.id));
	const start = reply.indexOf("{");
	const end = reply.lastIndexOf("}");
	if (start === -1 || end <= start) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(reply.slice(start, end + 1));
	} catch {
		return [];
	}
	const pairs = (parsed as { duplicates?: unknown }).duplicates;
	if (!Array.isArray(pairs)) return [];
	const accepted: Array<{ id: string; into: string; reason: string }> = [];
	for (const pair of pairs) {
		if (!pair || typeof pair !== "object") continue;
		const { id, into, reason } = pair as { id?: unknown; into?: unknown; reason?: unknown };
		if (typeof id !== "string" || typeof into !== "string") continue;
		// Both ids must exist and must not be the same finding.
		if (!known.has(id) || !known.has(into) || id === into) continue;
		accepted.push({ id, into, reason: typeof reason === "string" ? reason.slice(0, 200) : "same root cause" });
	}
	return accepted;
}

/** The deterministic pass on its own: exact duplicates, no model required. */
export function dedupeFindings(candidates: readonly DedupeCandidate[]): DedupeResult {
	return exactDuplicates(candidates);
}
