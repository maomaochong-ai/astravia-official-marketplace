import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findPrecedent, renderPrecedentHit, SHIPPED_PRECEDENTS } from "../domain/case/precedents";
import { HPKIT_FILES, planScaffold, readCaseText, renderScaffoldPlan } from "../domain/case/scaffold";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const kitDir = join(pluginRoot, "cases/_shared/hpkit");

describe("shared case kit", () => {
	// scaffolding copies a fixed list because the runtime cannot read a directory;
	// a new module in cases/_shared/hpkit/ that nobody adds here would silently
	// produce a directory whose imports fail.
	it("HPKIT_FILES matches the modules on disk", () => {
		const onDisk = readdirSync(kitDir)
			.filter(name => name.endsWith(".py"))
			.sort();
		expect([...HPKIT_FILES].sort()).toEqual(onDisk);
	});
});

describe("scaffold plan", () => {
	const precedent = SHIPPED_PRECEDENTS.find(entry => entry.tools.tools.length > 0);

	it("every runnable precedent ships the shared kit beside its tools", () => {
		for (const entry of SHIPPED_PRECEDENTS) {
			const plan = planScaffold(entry, { into: `/project/${entry.slug}` });
			const paths = plan.files.map(file => file.path);
			for (const name of HPKIT_FILES) expect(paths).toContain(`tools/hpkit/${name}`);
			for (const tool of entry.tools.tools) expect(paths).toContain(`tools/${tool.entry}`);
			if (entry.tools.tools.length > 0) expect(paths).toContain("tools/manifest.json");
		}
	});

	it("writes into <cwd>/<slug> when no directory is given", () => {
		const sample = SHIPPED_PRECEDENTS[0];
		expect(planScaffold(sample, { cwd: "/work" }).directory).toBe(`/work/${sample.slug}`);
	});

	it("offers the self test before any real invocation", () => {
		expect(precedent, "no shipped precedent declares a tool yet").toBeDefined();
		const commands = planScaffold(precedent!, { cwd: "/work" }).commands;
		expect(commands[0]).toMatch(/--self-test$/);
		expect(commands.slice(precedent!.tools.tools.length).every(command => !command.includes("--self-test"))).toBe(
			true,
		);
	});

	it("reads a shipped tool back as the bytes on disk", async () => {
		const body = await readCaseText(`cases/${precedent!.slug}/tools/${precedent!.tools.tools[0].entry}`);
		expect(body).toContain("--self-test");
		expect(body.length).toBeGreaterThan(400);
	});

	it("says plainly that scaffolding executed nothing", () => {
		const plan = planScaffold(precedent!, { cwd: "/work" });
		const rendered = renderScaffoldPlan(plan, ["tools/manifest.json"], ["tools/gate_scan.py"]);
		expect(rendered).toContain("Nothing was executed");
		expect(rendered).toContain("auth.status=pending");
		expect(rendered).toContain("left untouched");
	});
});

describe("precedent hit rendering", () => {
	it("names the runnable tools when a package ships them", () => {
		const entry = SHIPPED_PRECEDENTS.find(precedent => precedent.tools.tools.length > 0);
		expect(entry, "no shipped precedent declares a tool yet").toBeDefined();
		const hit = renderPrecedentHit({ precedent: entry!, score: 0, matched: 0, reasons: ["test"] });
		expect(hit).toContain(`- tools: ${entry!.tools.tools[0].id}`);
		expect(hit).toContain("scaffold_case");
	});

	it("resolve returns the same object the index lists", () => {
		for (const entry of SHIPPED_PRECEDENTS) expect(findPrecedent(entry.slug)).toBe(entry);
	});
});
