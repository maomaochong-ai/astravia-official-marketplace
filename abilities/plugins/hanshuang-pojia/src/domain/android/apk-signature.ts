/**
 * `apksigner verify --print-certs` 的输出解析。
 *
 * 为什么要有这一层：`archive-facts.ts` 只回答「有哪几套方案」——那是读 v1 文件与 APK
 * Signing Block 的存在性，**不是验签**。真正的密码学结论只有 apksigner（或 keytool）能给，
 * 而它输出的是给人看的自由文本，退出码又只在「完全不通过」时才非零。所以把文本变成结构，
 * 让工具层能分开说：方案在不在、验签过没过、签名者是谁、失败原因是什么。
 *
 * 解析必须宽容：apksigner 的版本差异体现在多出来的行（v3.1 / v4 / SourceStamp / 旋转
 * lineage），未知行一律进 `unparsed`，不猜。
 */

/** 一套签名方案的验签结果。`scheme` 原样保留 apksigner 的写法（`v1`、`v3.1` …）。 */
export interface SignatureSchemeState {
	scheme: string;
	verified: boolean;
}

/** 一个签名者。字段名对齐 apksigner 的行标签，缺失即 `null`。 */
export interface SignatureSigner {
	index: number;
	/** 证书主题，例如 `CN=Android Debug,O=Android,C=US`。 */
	dn: string | null;
	/** 证书 DER 的 SHA-256，十六进制小写。 */
	certificateSha256: string | null;
	keyAlgorithm: string | null;
	keySizeBits: number | null;
	publicKeySha256: string | null;
}

export interface ApksignerVerdict {
	/** `null` = 输出里既没有 `Verifies` 也没有 `DOES NOT VERIFY`，无法判定。 */
	verifies: boolean | null;
	schemes: SignatureSchemeState[];
	signerCount: number | null;
	signers: SignatureSigner[];
	warnings: string[];
	errors: string[];
	/** 没认出来的行，按出现顺序保留前若干条，用于对照 apksigner 版本差异。 */
	unparsed: string[];
}

const MAX_MESSAGES = 8;
const MAX_UNPARSED = 6;

/** `Signer #1 certificate DN: …` → 字段名到模型字段的映射。 */
const SIGNER_FIELDS: Record<string, keyof Omit<SignatureSigner, "index">> = {
	"certificate dn": "dn",
	"certificate sha-256 digest": "certificateSha256",
	"key algorithm": "keyAlgorithm",
	"key size (bits)": "keySizeBits",
	"public key sha-256 digest": "publicKeySha256",
};

function normaliseDigest(value: string): string {
	return value.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

/**
 * 把 apksigner 的 stdout / stderr / 退出码合成一份结论。
 *
 * `exitCode` 只做兜底：`verifies` 为 `null` 且退出码非零时判 `false`，因为 apksigner 在
 * 无法解析 APK（不是签名失败，而是压根读不动）时也只给退出码。
 */
export function parseApksignerVerdict(stdout: string, stderr: string, exitCode: number | null): ApksignerVerdict {
	const text = `${stdout}\n${stderr}`;
	const lines = text.split("\n").map(line => line.trim());

	let verifies: boolean | null = null;
	if (lines.some(line => line === "Verifies")) verifies = true;
	if (lines.some(line => line === "DOES NOT VERIFY")) verifies = false;

	const schemes: SignatureSchemeState[] = [];
	for (const match of text.matchAll(/Verified using (v[\d.]+) scheme[^:]*:\s*(true|false)/g)) {
		schemes.push({ scheme: match[1]!, verified: match[2] === "true" });
	}

	const signerMatch = /Number of signers:\s*(\d+)/.exec(text);
	const signerCount = signerMatch ? Number(signerMatch[1]) : null;

	const signers: SignatureSigner[] = [];
	const warnings: string[] = [];
	const errors: string[] = [];
	const unparsed: string[] = [];

	for (const line of lines) {
		if (line === "") continue;
		// 这几类已经用全文正则取过，不该再被当成「没认出来的行」重复计数。
		if (line === "Verifies" || line === "DOES NOT VERIFY") continue;
		if (/^Verified (using|for) /.test(line) || /^Number of signers:/.test(line)) continue;
		const warning = /^WARNING:\s*(.+)$/.exec(line);
		if (warning) {
			if (warnings.length < MAX_MESSAGES) warnings.push(warning[1]!);
			continue;
		}
		const error = /^ERROR:\s*(.+)$/.exec(line);
		if (error) {
			if (errors.length < MAX_MESSAGES) errors.push(error[1]!);
			continue;
		}
		const signer = /^Signer #(\d+) ([^:]+):\s*(.*)$/.exec(line);
		if (signer) {
			const index = Number(signer[1]);
			const field = SIGNER_FIELDS[signer[2]!.trim().toLowerCase()];
			if (!field) {
				if (unparsed.length < MAX_UNPARSED) unparsed.push(line);
				continue;
			}
			let entry = signers.find(item => item.index === index);
			if (!entry) {
				entry = { index, dn: null, certificateSha256: null, keyAlgorithm: null, keySizeBits: null, publicKeySha256: null };
				signers.push(entry);
			}
			const raw = signer[3]!.trim();
			if (field === "keySizeBits") {
				const bits = Number(raw);
				entry.keySizeBits = Number.isFinite(bits) ? bits : null;
			} else if (field === "certificateSha256" || field === "publicKeySha256") {
				entry[field] = normaliseDigest(raw) || null;
			} else {
				entry[field] = raw || null;
			}
			continue;
		}
		// 没认出来的行留在 unparsed 里：apksigner 换版本时新增的输出不该被默默吃掉。
		if (unparsed.length < MAX_UNPARSED) unparsed.push(line);
	}

	if (verifies === null && exitCode !== null && exitCode !== 0) verifies = false;

	signers.sort((left, right) => left.index - right.index);
	return { verifies, schemes, signerCount, signers, warnings, errors, unparsed };
}

/** 把 `expected_digest` 归一化，便于和证书 / v1 块摘要比对。 */
export function normaliseExpectedDigest(value: string): string {
	return normaliseDigest(value);
}
