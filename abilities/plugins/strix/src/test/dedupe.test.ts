import { describe, expect, it } from "vitest";
import { dedupeInstruction, exactDuplicates, parseDedupeReply, type DedupeCandidate } from "../service/dedupe";

/**
 * Dedupe is a judgement call about *root cause at a sink*, so the parts worth pinning are
 * the ones that must not be left to a model: the deterministic collapse, and the refusal
 * to accept an answer that invents or self-references ids.
 */

const candidate = (over: Partial<DedupeCandidate> & { id: string }): DedupeCandidate => ({
	title: "SQL injection",
	severity: "high",
	location: "POST /api/orders",
	...over,
});

describe("finding dedupe", () => {
	it("collapses identical title + location without asking a model", () => {
		const result = exactDuplicates([
			candidate({ id: "a" }),
			candidate({ id: "b", description: "different payload" }),
			candidate({ id: "c", location: "POST /api/users" }),
		]);
		expect(result.usedModel).toBe(false);
		expect(result.duplicates).toEqual([{ id: "b", into: "a", reason: "same title at the same location" }]);
	});

	it("normalises case and whitespace before comparing", () => {
		const result = exactDuplicates([candidate({ id: "a" }), candidate({ id: "b", title: "  sql INJECTION " })]);
		expect(result.duplicates.map((duplicate) => duplicate.id)).toEqual(["b"]);
	});

	it("asks for one JSON shape and names the sink rule explicitly", () => {
		const prompt = dedupeInstruction([candidate({ id: "a" })]);
		expect(prompt).toContain('"duplicates"');
		expect(prompt).toContain("SAME sink");
		expect(prompt).toContain("Never invent an id");
	});

	it("refuses ids that do not exist, and self-merge", () => {
		const listed = [candidate({ id: "a" }), candidate({ id: "b" })];
		const reply = JSON.stringify({
			duplicates: [
				{ id: "b", into: "a", reason: "same sink" },
				{ id: "ghost", into: "a", reason: "invented" },
				{ id: "a", into: "a", reason: "self" },
				{ id: "a", into: "ghost", reason: "invented target" },
			],
		});
		expect(parseDedupeReply(reply, listed)).toEqual([{ id: "b", into: "a", reason: "same sink" }]);
	});

	it("treats prose around the JSON as tolerable, and junk as nothing", () => {
		const listed = [candidate({ id: "a" }), candidate({ id: "b" })];
		expect(parseDedupeReply('Here you go:\n{"duplicates":[{"id":"b","into":"a"}]}\nDone.', listed)).toHaveLength(1);
		expect(parseDedupeReply("I could not decide.", listed)).toEqual([]);
		expect(parseDedupeReply('{"duplicates":"nope"}', listed)).toEqual([]);
	});
});
