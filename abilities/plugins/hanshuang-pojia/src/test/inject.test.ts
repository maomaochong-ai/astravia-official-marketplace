import { describe, expect, it } from "vitest";
import {
	ASTRAVIA_AGENTS_FILE,
	INJECT_BEGIN_LINE,
	INJECT_END_LINE,
	buildAstraviaInjectBlock,
	hasMarkerBlock,
	normalize,
	replaceExistingBlock,
} from "../domain/inject/astravia-block";

const BODY = ["# 常驻契约", "", "- 本地沙盒样本白盒审计（CWE-602）", "- 交付形状：Locate → Patch → Verify → Rollback"].join("\n");

describe("install_astravia injector block", () => {
	it("emits a marker-fenced block with begin/end markers and the body", () => {
		const { block } = buildAstraviaInjectBlock({ body: BODY, sourceLabel: "2.9.0" });
		expect(block).toContain(INJECT_BEGIN_LINE);
		expect(block).toContain(INJECT_END_LINE);
		expect(block).toContain("2.9.0");
		expect(block).toContain("CWE-602");
		expect(hasMarkerBlock(block)).toBe(true);
	});

	it("proposes AGENTS.md as the target file", () => {
		expect(buildAstraviaInjectBlock({ body: BODY }).fileName).toBe(ASTRAVIA_AGENTS_FILE);
	});

	it("is idempotent: replaceExistingBlock swaps only the fenced region, keeping outside content", () => {
		const userPrefix = "# 用户自己的 AGENTS.md\n\n- do not touch this\n\n";
		const userSuffix = "\n- keep this too\n";
		const first = buildAstraviaInjectBlock({ body: BODY, sourceLabel: "v2" });
		const combined = userPrefix + first.block + userSuffix;
		expect(normalize(combined)).toContain("do not touch this");

		// 第二次注入同一标记块：replaceOnlyInside 应产出只换块、保留前缀后缀的新内容。
		const second = buildAstraviaInjectBlock({ body: BODY.replace("CWE-602", "CWE-602 更新"), sourceLabel: "v3" });
		const replaced = replaceExistingBlock(combined, second.block);
		expect(replaced).not.toBeNull();
		expect(replaced).toContain("do not touch this");
		expect(replaced).toContain("keep this too");
		expect(replaced).toContain("CWE-602 更新");
		expect(replaced).not.toContain("v2");
	});

	it("returns null replacement when the target has no existing block", () => {
		const { replacement } = buildAstraviaInjectBlock({ body: BODY }, "# 无标记的脏文件");
		expect(replacement).toBeUndefined();
	});

	it("restore note explains marker removal and manual backup for user content", () => {
		const { restoreNote } = buildAstraviaInjectBlock({ body: BODY });
		expect(restoreNote).toContain(INJECT_END_LINE);
		expect(restoreNote).toContain("备份");
		expect(restoreNote).toContain("摘除");
	});
});