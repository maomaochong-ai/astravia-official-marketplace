import { describe, expect, it } from "vitest";
import { hasOpenAssessment } from "../domain/assessment-presence";
import { isStrixEngaged, setStrixEngaged } from "../domain/engagement";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The reported failure, in three parts, each with its own witness:
 *
 *  - the capsule showed and the conversation then said "I have no strix_* tools",
 *    because the manifest gated every agent contribution on an optional CLI;
 *  - the panel sat on the launch screen while the host chat drove the sandbox, because
 *    the screen depended on this component having seen a message, not on what the
 *    service actually holds;
 *  - the panel's transcript rendered a model answer as one block of text.
 */

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "plugin.json"), "utf8")) as {
	providers?: { cli?: unknown; services?: { id: string }[] };
	agent: { mcpServers: Record<string, { type: string; serviceId: string }> };
};
const index = readFileSync(resolve(process.cwd(), "src/index.tsx"), "utf8");
const session = readFileSync(resolve(process.cwd(), "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");
const trace = readFileSync(resolve(process.cwd(), "src/features/scan-console/components/trace-block.tsx"), "utf8");
const zh = JSON.parse(readFileSync(resolve(process.cwd(), "locales/zh.json"), "utf8")) as Record<string, string>;

describe("nothing glues the tool surface to a CLI that is not needed", () => {
	it("declares no CLI provider, so the agent contributions are never gated on one", () => {
		// `arePluginCliProvidersReady()` drops the *entire* agent block — skills and MCP
		// servers both — while any declared CLI provider is not ready. The bridge reads the
		// Python package's copy of the skills when it exists and ships its own when it does
		// not, so a CLI requirement bought nothing and cost the whole toolkit.
		expect(manifest.providers?.cli, "a cli provider here silently disables agent.mcpServers").toBeUndefined();
		expect(manifest.providers?.services?.map((service) => service.id)).toEqual(["strix-bridge"]);
	});

	it("still advertises its tools over the plugin's own service", () => {
		expect(manifest.agent.mcpServers.strix).toMatchObject({ type: "service", serviceId: "strix-bridge" });
	});

	it("starts the bridge when the plugin activates, not when a tab happens to mount", () => {
		const boot = index.indexOf("void runtime.ensureReady()");
		expect(boot).toBeGreaterThan(-1);
		expect(boot, "the service must be up before the first session builds its tool roster").toBeLessThan(
			index.indexOf("registerActivityTab"),
		);
	});
});

describe("the prompt matches the tools that exist", () => {
	it("names the four groups the MCP server actually serves", () => {
		const prompt = zh["prompt.instructions"];
		for (const tool of [
			"strix_environment",
			"strix_sandbox_start",
			"strix_exec",
			"strix_list_skills",
			"strix_load_skills",
			"strix_file_finding",
			"strix_report",
			"strix_proxy",
			"strix_threat_model",
		]) {
			expect(prompt, `prompt never mentions ${tool}`).toContain(tool);
		}
	});

	it("says what to do when the roster has no strix_* tool", () => {
		// The old text asserted the toolkit was there; the model then had to invent a
		// reason. Honest degradation is the instruction's job.
		const prompt = zh["prompt.instructions"];
		expect(prompt).toContain("没有 strix_*");
		expect(prompt).toContain("不要用 shell");
		expect(zh["prompt.instructionsStarting"]).toContain("尚未就绪");
	});
});

describe("the panel follows the host conversation", () => {
	it("leaves the launch screen when the host turn starts with the capsule on", () => {
		expect(session).toContain('event.type === "turn-start"');
		expect(session).toContain("isStrixEngaged()");
		expect(session).toContain('t("scan.followingHost")');
	});

	it("reopens on the scan screen when the service already holds an assessment", () => {
		expect(session).toContain("hasOpenAssessment(");
		expect(session).toContain('t("scan.resumed")');
	});

	it("treats a live sandbox, a finding or a plan as an open assessment", () => {
		expect(hasOpenAssessment(undefined)).toBe(false);
		expect(hasOpenAssessment({ sandbox: { running: true } })).toBe(true);
		expect(hasOpenAssessment({ findings: [{ id: "f1" }] })).toBe(true);
		expect(hasOpenAssessment({ todos: [{ id: "t1" }] })).toBe(true);
		expect(hasOpenAssessment({ notes: [{ id: "n1" }] })).toBe(true);
		expect(hasOpenAssessment({ coverage: [{ key: "k" }] })).toBe(true);
		expect(hasOpenAssessment({ threatModel: { content: "  " } })).toBe(false);
		expect(hasOpenAssessment({ threatModel: { content: "assets in scope" } })).toBe(true);
	});

	it("keeps the capsule state outside the tab, so a remount still knows", () => {
		setStrixEngaged(true);
		expect(isStrixEngaged()).toBe(true);
		setStrixEngaged(false);
		expect(isStrixEngaged()).toBe(false);
	});
});

describe("the transcript reads as a report, not a dump", () => {
	it("labels host rows instead of rendering them as anonymous text", () => {
		expect(trace).toContain("hostSayLabel");
		expect(trace).toContain("astra-strix-host");
	});

	it("splits prose into paragraphs and caps collapsed tool output", () => {
		expect(trace).toContain("OUTPUT_PREVIEW_LINES");
		expect(trace).toContain("split(/\\n{2,}/)");
		expect(trace).toContain("已截断");
	});
});
