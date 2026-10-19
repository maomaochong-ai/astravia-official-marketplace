import { describe, expect, it } from "vitest";
import { reportToJson, renderMarkdown, truncateMarkdown } from "../domain/report/report";
import { triage } from "../domain/triage";
import { APK_SECRET, buildApk, buildDex, buildElf, buildPe, buildZip, utf8 } from "./fixtures";

const sample = (name: string, bytes: Uint8Array) => ({ path: `/work/${name}`, name, bytes });

describe("triage", () => {
	it("audits a debug, exported Android package end to end", async () => {
		const report = await triage(sample("demo.apk", buildApk()));
		expect(report.schemaVersion).toBe(1);
		expect(report.target.format).toBe("apk");
		expect(report.target.formatLabel).toBe("Android package (APK)");
		expect(report.target.sha256).toHaveLength(64);
		expect(report.risk.score).toBeGreaterThanOrEqual(55);
		expect(report.risk.grade).toBe("E");

		const ruleIds = report.findings.map(item => item.ruleId);
		expect(ruleIds).toEqual(
			expect.arrayContaining([
				"apk.debuggable",
				"apk.exported-component",
				"apk.exported-provider",
				"apk.allow-backup",
				"apk.cleartext-traffic",
				"apk.min-sdk-low",
				"apk.dangerous-permission",
				"apk.hardcoded-secret",
			]),
		);
		const secret = report.findings.find(item => item.ruleId === "apk.hardcoded-secret");
		expect(secret?.evidence.join(" ")).not.toContain(APK_SECRET);
		expect(secret?.evidence.join(" ")).toContain("AKIA");

		expect(report.summary.some(line => line.includes("com.example.triage"))).toBe(true);
		expect(report.sections.map(section => section.id)).toEqual(
			expect.arrayContaining(["components", "permissions", "dex"]),
		);
		expect(report.risk.drivers.length).toBeGreaterThan(0);
		expect(report.risk.drivers.length).toBeLessThanOrEqual(4);
	});

	it("flags traversal entries and unsigned packages", async () => {
		const archive = buildZip([
			{ name: "../escape.txt", data: utf8("x") },
			{ name: "assets/payload.dex", data: new Uint8Array(4) },
		]);
		const report = await triage(sample("odd.zip", archive));
		expect(report.target.format).toBe("zip");
		const ruleIds = report.findings.map(item => item.ruleId);
		expect(ruleIds).toContain("archive.path-traversal");
		expect(ruleIds).toContain("archive.embedded-executable");
	});

	it("labels native formats and hides unknown system details", async () => {
		const elf = await triage(sample("lib.so", buildElf()));
		expect(elf.target.format).toBe("elf");
		expect(elf.summary[0]).toBe("ELF binary · x86-64 · shared object / PIE");
		expect(elf.facts.some(row => row.label === "Entry point")).toBe(true);

		const pe = await triage(sample("tool.exe", buildPe()));
		expect(pe.summary[0]).toBe("PE / Windows image · x86-64 · executable");
		expect(pe.facts.find(row => row.label === "Linked libraries")?.value).toBe("1");
	});

	it("keeps the markdown report inside its context budget", async () => {
		const report = await triage(sample("demo.apk", buildApk()), { mode: "summary" });
		const summary = renderMarkdown(report, { mode: "summary" });
		const full = renderMarkdown(report, { mode: "full" });
		expect(summary.length).toBeLessThanOrEqual(4500);
		expect(full.length).toBeLessThanOrEqual(24000);
		expect(summary).toContain(`# Binary triage — demo.apk`);
		expect(summary).toContain("## Findings");
		expect(full.length).toBeGreaterThan(summary.length);
	});

	it("truncation keeps whole lines and says so", () => {
		const text = Array.from({ length: 400 }, (_, index) => `line ${index}`).join("\n");
		const cut = truncateMarkdown(text, 200);
		expect(cut.length).toBeLessThan(400);
		expect(cut.endsWith("for the remaining sections)_")).toBe(true);
		expect(truncateMarkdown("short", 100)).toBe("short");
	});

	it("serialises to stable JSON", async () => {
		const report = await triage(sample("demo.apk", buildApk()));
		const parsed = JSON.parse(reportToJson(report)) as { schemaVersion: number; target: { name: string } };
		expect(parsed.schemaVersion).toBe(1);
		expect(parsed.target.name).toBe("demo.apk");
	});

	it("falls back to string and entropy facts for unknown containers", async () => {
		const report = await triage(sample("blob.bin", new TextEncoder().encode("not a known format ".repeat(20))));
		expect(report.target.format).toBe("unknown");
		expect(report.limits.length).toBeGreaterThan(0);
		expect(report.findings).toHaveLength(1);
		expect(report.findings[0]?.ruleId).toBe("format.unknown");
		expect(report.findings[0]?.severity).toBe("info");
	});

	it("recognises a bare DEX payload", async () => {
		const report = await triage(sample("classes.dex", buildDex(["Lcom/example/Main;", "Ljava/lang/Runtime;->exec"])));
		expect(report.target.format).toBe("dex");
		expect(report.summary[0]).toContain("classes");
	});
});
