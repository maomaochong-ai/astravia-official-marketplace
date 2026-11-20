/**
 * 注入矩阵与卸载兜底的行为断言。
 *
 * 对齐上游 `install-*.ps1` 的 `-Uninstall` / `-RestoreMemory` 之后，卸载有四种情形；
 * 这组用例逐条盯住它们，避免“看起来能卸、实际卸不掉”：
 *   1. 现行标记块；
 *   2. 旧标记块（`HANSHUANG-INJECT`）；
 *   3. 无标记但命中特征串 → 找一份干净备份还原，且**不把注入了内容的备份当原始备份**；
 *   4. 本来就没装。
 */

import { describe, expect, it } from "vitest";
import { buildMatrix } from "../../domain/inject/matrix";
import { renderBatchRemoval, renderRemovalScript } from "../../domain/inject/removal";
import { INJECT_SIGNATURES, INJECT_TARGETS, LEGACY_MARKER_BEGIN, planFor, targetById, usableTargets } from "../../domain/inject/targets";

const body = "正文";

function planOf(id: string) {
	return planFor(targetById(id)!, { packLabel: "execution-kernel", body });
}

describe("uninstall script covers the four cases", () => {
	it("recognises the current marker, the legacy marker and content signatures", () => {
		const script = renderRemovalScript(planOf("codex"), "powershell");
		expect(script).toContain("寒霜破甲注入开始");
		expect(script).toContain(LEGACY_MARKER_BEGIN);
		for (const signature of INJECT_SIGNATURES) expect(script).toContain(signature);
	});

	it("falls back to the newest clean backup, skipping artifacts and empty files", () => {
		const script = renderRemovalScript(planOf("claude"), "powershell");
		// 只看长度 > 0、且自身不是注入产物的备份。
		expect(script).toContain("Length -gt 0");
		expect(script).toContain("Test-Artifact $_.FullName");
		expect(script).toContain("restored from clean backup");
		// 找不到干净备份时明确要求人工处理，而不是静默成功。
		expect(script).toContain("restore manually");
		expect(script).toContain("exit 2");
	});

	it("says not-installed and exits 0 when there is nothing to remove", () => {
		const script = renderRemovalScript(planOf("dsh"), "posix");
		expect(script).toContain("not installed");
		expect(script).toContain("exit 0");
	});

	it("keeps whole-file targets on the restore path", () => {
		const script = renderRemovalScript(planOf("opencode"), "powershell");
		// 系统层没有块可摘：走备份还原，不出现标记常量。
		expect(script).toContain("hanshuang-backup-");
		expect(script).not.toContain(LEGACY_MARKER_BEGIN);
	});

	it("batch removal applies the same four steps to every marker-block target", () => {
		const plans = INJECT_TARGETS.map(item => planFor(item, { packLabel: "execution-kernel", body }));
		const script = renderBatchRemoval(plans, "powershell");
		for (const target of INJECT_TARGETS.filter(item => item.form === "marker-block")) {
			expect(script).toContain(target.entry);
		}
		expect(script).toContain("Strip-Block");
		expect(script).toContain("restored from clean backup");
	});
});

describe("matrix expands to every usable target", () => {
	it("skips unavailable targets and emits install + uninstall + one batch per shell", () => {
		const files = buildMatrix({ body, packLabel: "execution-kernel" });
		const pythonExcluded = files.every(file => file.target !== "doubao");
		expect(pythonExcluded).toBe(true);
		const perShell = usableTargets().length * 2 + 1;
		expect(files).toHaveLength(perShell * 2);
		expect(files.filter(file => file.kind === "batch")).toHaveLength(2);
	});

	it("honours --shell / --kind / --target filters", () => {
		expect(buildMatrix({ body, packLabel: "p", shell: "posix", kind: "remove" }).every(file => file.shell === "posix")).toBe(true);
		const single = buildMatrix({ body, packLabel: "p", target: "codex", kind: "install", shell: "powershell" });
		expect(single.map(file => file.name)).toEqual(["codex-install.ps1"]);
	});
});
