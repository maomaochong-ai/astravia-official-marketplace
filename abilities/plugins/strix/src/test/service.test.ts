import { describe, expect, it } from "vitest";
import { runArgs } from "../service/docker";
import { tally as coverageTally } from "../service/coverage";
import { bySeverity, normalizeSeverity, renderReport, tally, type Finding } from "../service/findings";
import { toSarif } from "../service/sarif";
import { sortTodos } from "../service/todo";
import { parseFrontmatter } from "../service/skills";
import { containerName, mountsFrom, quote, tail } from "../service/sandbox";

const finding = (overrides: Partial<Finding> = {}): Finding => ({
	id: "a1",
	title: "IDOR on /api/orders",
	severity: "critical",
	target: "https://app.example.com",
	description: "Any user can read another tenant's orders.",
	impact: "",
	technical_analysis: "",
	poc_description: "GET /api/orders/42 with tenant B's token.",
	remediation_steps: "Authorise by tenant id server-side.",
	evidence: "200 OK, other tenant's data",
	cvss: 8.1,
	cwe: "CWE-639",
	cve: "",
	confidence: "high",
	created_at: "2026-01-01T00:00:00Z",
	...overrides,
});

describe("sandbox argv", () => {
	it("mounts each source into /workspace, keeps the image entrypoint out of the way, and grants raw sockets", () => {
		const args = runArgs({
			name: "astravia-strix-s1",
			image: "ghcr.io/usestrix/strix-sandbox:1.4.0",
			mounts: [{ host: "D:/work/app", name: "app", readOnly: true }],
		});
		expect(args).toEqual([
			"run",
			"-d",
			"--name",
			"astravia-strix-s1",
			// nmap -sS and naabu open raw sockets; without these they exit 1.
			"--cap-add",
			"NET_RAW",
			"--cap-add",
			"NET_ADMIN",
			"--add-host",
			"host.docker.internal:host-gateway",
			"-v",
			"D:/work/app:/workspace/app:ro",
			"--entrypoint",
			"sleep",
			"ghcr.io/usestrix/strix-sandbox:1.4.0",
			"infinity",
		]);
	});

	it("derives a workspace name from the path when none is given", () => {
		expect(mountsFrom([{ path: "D:/repos/my app" }])).toEqual([
			{ host: "D:/repos/my app", name: "my-app", readOnly: false },
		]);
	});

	it("sanitises the session id into a docker-safe container name", () => {
		// Spaces and slashes go, `..` collapses, and a leading separator would be invalid.
		expect(containerName("s 1/../x")).toBe("astravia-strix-s1.x");
		expect(containerName("../evil")).toBe("astravia-strix-evil");
	});
});

describe("command helpers", () => {
	it("quotes a workdir so spaces and quotes survive sh -c", () => {
		expect(quote("it's here")).toBe("'it'\"'\"'s here'");
	});

	it("keeps the last lines of output for the panel, not the first", () => {
		expect(tail("a\nb\nc\nd", 2)).toBe("c\nd");
	});
});

describe("skills frontmatter", () => {
	it("reads flat scalars and strips the block from the body", () => {
		const { meta, body } = parseFrontmatter("---\nname: owasp\ndescription: \"Top ten\"\n---\n\n# Body\n");
		expect(meta).toEqual({ name: "owasp", description: "Top ten" });
		expect(body).toBe("# Body");
	});

	it("treats a file without frontmatter as all body", () => {
		expect(parseFrontmatter("# just text")).toEqual({ meta: {}, body: "# just text" });
	});
});

describe("findings", () => {
	it("orders by severity and tallies every bucket", () => {
		const items = [finding({ id: "1", severity: "low" }), finding({ id: "2" }), finding({ id: "3", severity: "high" })];
		expect(bySeverity(items).map((item) => item.severity)).toEqual(["critical", "high", "low"]);
		expect(tally(items)).toEqual({ critical: 1, high: 1, medium: 0, low: 1, info: 0 });
	});

	it("keeps an unknown severity visible rather than dropping the finding", () => {
		expect(normalizeSeverity("weird")).toBe("info");
		expect(normalizeSeverity(undefined)).toBe("info");
	});

	it("renders a report that carries the proof and the fix", () => {
		const markdown = renderReport([finding()], ["https://app.example.com"]);
		expect(markdown).toContain("## Findings (1)");
		expect(markdown).toContain("critical: 1");
		expect(markdown).toContain("**Proof of concept**");
		expect(markdown).toContain("tenant B's token");
		expect(markdown).toContain("**Remediation**");
		expect(markdown).toContain("CWE-639");
	});

	it("says so plainly when nothing was found", () => {
		expect(renderReport([], [])).toContain("No findings were filed.");
	});
});

describe("assessment artefacts", () => {
	it("maps a finding to one SARIF rule and result, with severity as security-severity", () => {
		const sarif = toSarif([finding({ code_locations: [{ file: "src/orders.py", start_line: 42 }] })], { version: "1.0.0" });
		const run = sarif.runs[0]!;
		expect(run.tool.driver.version).toBe("1.0.0");
		expect(run.tool.driver.rules.map((rule) => rule.id)).toEqual(["CWE-639"]);
		expect(run.results).toHaveLength(1);
		expect(run.results[0]).toMatchObject({
			ruleId: "CWE-639",
			level: "error",
			locations: [{ physicalLocation: { artifactLocation: { uri: "src/orders.py" }, region: { startLine: 42 } } }],
		});
	});

	it("groups findings of the same class under one rule", () => {
		const sarif = toSarif([finding({ id: "1" }), finding({ id: "2" })]);
		expect(sarif.runs[0]!.tool.driver.rules).toHaveLength(1);
		expect(sarif.runs[0]!.results).toHaveLength(2);
	});

	it("writes coverage as a tally, not prose", () => {
		const tally = coverageTally([
			{ id: "1", surface: "a", outcome: "clean", technique: "", evidence: "", note: "", created_at: "" },
			{ id: "2", surface: "b", outcome: "vulnerable", technique: "", evidence: "", note: "", created_at: "" },
		]);
		expect(tally).toEqual({ vulnerable: 1, clean: 1, skipped: 0 });
	});

	it("sorts the plan the way the panel shows it: in progress, then pending, then done", () => {
		const todos = sortTodos([
			{ id: "1", title: "done", status: "done", priority: "normal", created_at: "", updated_at: "" },
			{ id: "2", title: "pending", status: "pending", priority: "normal", created_at: "", updated_at: "" },
			{ id: "3", title: "working", status: "in_progress", priority: "normal", created_at: "", updated_at: "" },
		]);
		expect(todos.map((todo) => todo.title)).toEqual(["working", "pending", "done"]);
	});
});
