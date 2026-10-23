import { describe, expect, it } from "vitest";
import { CHECKLIST_TYPES, checklistById, checklistMenu, extractPayloadSections, payloadHeadings } from "../domain/playbooks";

const SEEDS = [
	"# Web Payload Seeds",
	"",
	"Intro line that belongs to no section.",
	"",
	"## Reflection / HTML",
	"",
	"```text",
	"{{7*7}}",
	"```",
	"",
	"## SQLi",
	"",
	"```text",
	"' OR '1'='1'--",
	"```",
	"",
	"## NoSQLi JSON",
	"",
	"```json",
	'{"$ne":null}',
	"```",
	"",
	"## JWT",
	"",
	"```text",
	"alg=none",
	"```",
].join("\n");

describe("checklists", () => {
	it("maps every upstream type onto a document that ships in this build", () => {
		expect(CHECKLIST_TYPES.map(entry => entry.id)).toEqual([
			"web_first_30_min",
			"attack_matrix",
			"evidence",
			"pe_ioc",
			"pe_persistence",
			"yara_rules",
		]);
		for (const entry of CHECKLIST_TYPES) {
			expect(entry.doc.startsWith("kb/")).toBe(true);
			expect(entry.label.trim()).not.toBe("");
		}
	});

	it("falls back to the first type only when nothing was asked for", () => {
		expect(checklistById("")?.id).toBe("web_first_30_min");
		expect(checklistById("   ")?.id).toBe("web_first_30_min");
		// An unknown name must not be silently replaced: the caller has to see the menu.
		expect(checklistById("not-a-type")).toBeUndefined();
	});

	it("matches type names case-insensitively and lists every type in the menu", () => {
		expect(checklistById("YARA_RULES")?.doc).toBe("kb/pe-reverse/techniques/07-yara-sigma/01-yara-rule-writing");
		for (const entry of CHECKLIST_TYPES) expect(checklistMenu()).toContain(entry.id);
	});
});

describe("payload sections", () => {
	it("reads the section headings of the seeds document", () => {
		expect(payloadHeadings(SEEDS)).toEqual(["Reflection / HTML", "SQLi", "NoSQLi JSON", "JWT"]);
	});

	it("returns only the requested class, with its heading", () => {
		const sections = extractPayloadSections(SEEDS, "ssrf");
		expect(sections).toHaveLength(0);
		const jwt = extractPayloadSections(SEEDS, "jwt");
		expect(jwt).toHaveLength(1);
		expect(jwt[0]?.heading).toBe("JWT");
		expect(jwt[0]?.body).toContain("alg=none");
		// The intro before the first heading must not leak into a class.
		expect(jwt[0]?.body).not.toContain("Intro line");
	});

	it("routes ssti to the reflection strings and prototype pollution to the JSON body", () => {
		expect(extractPayloadSections(SEEDS, "ssti")[0]?.heading).toBe("Reflection / HTML");
		expect(extractPayloadSections(SEEDS, "prototype")[0]?.heading).toBe("NoSQLi JSON");
	});

	it("treats `all` as no filter rather than a class name", () => {
		expect(extractPayloadSections(SEEDS, "all")).toEqual([]);
		expect(extractPayloadSections(SEEDS, "")).toEqual([]);
	});

	it("does not match a class that is absent", () => {
		expect(extractPayloadSections(SEEDS, "xxe")).toEqual([]);
	});
});
