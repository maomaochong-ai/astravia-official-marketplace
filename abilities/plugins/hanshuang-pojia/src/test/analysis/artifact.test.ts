// generate_artifact：四种骨架的生成形状与补丁表渲染。
// 骨架里不得出现编造的偏移或哈希——空着的字段就留占位，测试盯着这一点。

import { describe, expect, it } from "vitest";
import { generateArtifact, ARTIFACT_KINDS } from "../../domain/artifact/generators";

describe("generate_artifact generators", () => {
	it("exposes exactly the four kinds", () => {
		expect(ARTIFACT_KINDS).toEqual(["patch", "keygen", "proxy-dll", "verify"]);
	});

	it("patch: renders a copy-first byte-patch skeleton with a patch table", () => {
		const out = generateArtifact({
			kind: "patch",
			lang: "python",
			target: "sample.bin",
			locate: "r2: aaa; pdf @ sym.check_license",
			siteLines: ["0x1234 | 74 0E | EB 0E | 跳过授权分支"],
		});
		expect(out).toContain("Copy-first");
		expect(out).toContain("sha256");
		expect(out).toContain("sym.check_license");
		expect(out).toContain("0x1234");
		expect(out).toContain("| 74 0E | EB 0E | 跳过授权分支 |");
	});

	it("patch: sanity-tags the modified hash and names ROLLBACK", () => {
		const out = generateArtifact({ kind: "patch", lang: "python" });
		expect(out).toContain("ORIGINAL sha256");
		expect(out).toContain("MODIFIED sha256");
		expect(out).toContain("ROLLBACK");
	});

	it("keygen: includes test vectors and the checksum-only skeleton", () => {
		const out = generateArtifact({
			kind: "keygen",
			lang: "python",
			target: "crackme",
			testVectors: ["Alice => ALIC-AAAA", "Bob => BOB-CCCC"],
		});
		expect(out).toContain("测试向量");
		expect(out).toContain("Alice => ALIC-AAAA");
		expect(out).toContain("keygen");
		expect(out).toContain("checksum");
	});

	it("proxy-dll: emits a forwarding/interposition scaffold referencing list_code_symbols", () => {
		const out = generateArtifact({ kind: "proxy-dll", lang: "c" });
		expect(out).toContain("list_code_symbols");
		expect(out).toContain("__declspec(dllexport)");
		expect(out).toContain("MinGW");
	});

	it("verify: is the four-artifact VERIFICATION leg that replays both sides", () => {
		const out = generateArtifact({ kind: "verify", lang: "python" });
		expect(out).toContain("BASELINE");
		expect(out).toContain("MODIFIED");
		expect(out).toContain("VERDICT");
		expect(out).toContain("ROLLBACK");
	});

	it("does not fabricate offsets or hashes in the header when mislocated", () => {
		const out = generateArtifact({ kind: "patch", lang: "js" });
		expect(out).toContain("TODO"); // 无定位点时给占位，不编造实际偏移
	});

	it("every lang is accepted for every kind without throwing", () => {
		for (const kind of ARTIFACT_KINDS) {
			for (const lang of ["python", "c", "js"] as const) {
				expect(() => generateArtifact({ kind, lang })).not.toThrow();
			}
		}
	});
});