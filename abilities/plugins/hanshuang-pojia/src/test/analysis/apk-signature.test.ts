import { describe, expect, it } from "vitest";
import { normaliseExpectedDigest, parseApksignerVerdict } from "../../domain/android/apk-signature";

// apksigner verify --print-certs --verbose 的原文形状（build-tools 34/35 输出一致的部分）。
const VERIFIES = [
	"Verifies",
	"Verified using v1 scheme (JAR signing): true",
	"Verified using v2 scheme (APK Signature Scheme v2): true",
	"Verified using v3 scheme (APK Signature Scheme v3): false",
	"Verified using v3.1 scheme (APK Signature Scheme v3.1): false",
	"Verified using v4 scheme (APK Signature Scheme v4): false",
	"Verified for SourceStamp: false",
	"Number of signers: 1",
	"WARNING: META-INF/services/org.apache.commons.logging.LogFactory not protected by signature",
	"Signer #1 certificate DN: CN=Android Debug,O=Android,C=US",
	"Signer #1 certificate SHA-256 digest: 6a8b1f0c2d3e4f5061728394a5b6c7d8e9f0112233445566778899aabbccddee",
	"Signer #1 certificate SHA-1 digest: 0a1b2c3d4e5f60718293a4b5c6d7e8f901234567",
	"Signer #1 key algorithm: RSA",
	"Signer #1 key size (bits): 2048",
	"Signer #1 public key SHA-256 digest: ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100",
].join("\n");

describe("apksigner output", () => {
	it("reads the verdict, the per-scheme table and the signer certificate", () => {
		const verdict = parseApksignerVerdict(VERIFIES, "", 0);
		expect(verdict.verifies).toBe(true);
		expect(verdict.schemes).toEqual([
			{ scheme: "v1", verified: true },
			{ scheme: "v2", verified: true },
			{ scheme: "v3", verified: false },
			{ scheme: "v3.1", verified: false },
			{ scheme: "v4", verified: false },
		]);
		expect(verdict.signerCount).toBe(1);
		expect(verdict.signers).toHaveLength(1);
		expect(verdict.signers[0]).toEqual({
			index: 1,
			dn: "CN=Android Debug,O=Android,C=US",
			certificateSha256: "6a8b1f0c2d3e4f5061728394a5b6c7d8e9f0112233445566778899aabbccddee",
			keyAlgorithm: "RSA",
			keySizeBits: 2048,
			publicKeySha256: "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100",
		});
		// WARNING 单独成桶：它通常意味着有文件没被签名覆盖，正是要用的一手事实。
		expect(verdict.warnings).toHaveLength(1);
		expect(verdict.warnings[0]).toContain("not protected by signature");
		expect(verdict.errors).toEqual([]);
	});

	it("reports a failed verification with its reason", () => {
		const verdict = parseApksignerVerdict(
			"DOES NOT VERIFY\nERROR: APK Signature Scheme v2 signer #1 error: Signature verification failed",
			"",
			1,
		);
		expect(verdict.verifies).toBe(false);
		expect(verdict.schemes).toEqual([]);
		expect(verdict.errors[0]).toContain("v2 signer #1");
	});

	it("keeps a non-zero exit code as the only signal when nothing parses", () => {
		// apksigner 读不动文件时只给退出码，不给 Verifies / DOES NOT VERIFY；原文行留在 unparsed 里不丢。
		const verdict = parseApksignerVerdict("", "java.io.IOException: zip file is empty", 1);
		expect(verdict.verifies).toBe(false);
		expect(verdict.unparsed).toEqual(["java.io.IOException: zip file is empty"]);
		expect(parseApksignerVerdict("", "", 0).verifies).toBeNull();
	});

	it("collects unknown signer lines instead of guessing what they mean", () => {
		const verdict = parseApksignerVerdict("Signer #1 certificate rotation min sdk: 28", "", 0);
		expect(verdict.unparsed[0]).toContain("rotation min sdk");
		expect(verdict.signers).toEqual([]);
	});

	it("merges two signers by index and sorts them", () => {
		const verdict = parseApksignerVerdict(
			[
				"Signer #2 certificate DN: CN=Release",
				"Signer #1 certificate DN: CN=Debug",
				"Signer #1 key size (bits): 4096",
			].join("\n"),
			"",
			0,
		);
		expect(verdict.signers.map(signer => signer.index)).toEqual([1, 2]);
		expect(verdict.signers[0]?.keySizeBits).toBe(4096);
		expect(verdict.signers[1]?.dn).toBe("CN=Release");
	});
});

describe("expected digest", () => {
	it("ignores colons, spaces and case so a copied fingerprint still matches", () => {
		expect(normaliseExpectedDigest("6A:8B:1F:0C")).toBe("6a8b1f0c");
		expect(normaliseExpectedDigest(" 6a8b1f0c ")).toBe("6a8b1f0c");
	});
});
