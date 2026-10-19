export interface SecretPattern {
	kind: string;
	pattern: RegExp;
}

/**
 * 只匹配「形态明确」的凭据，并且证据一律打码。报告里出现完整密钥等于二次泄露，
 * 这条约束比多命中几个更重要。
 */
export const SECRET_PATTERNS: readonly SecretPattern[] = [
	{ kind: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
	{ kind: "AWS secret key", pattern: /\baws_?secret_?access_?key\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}\b/i },
	{ kind: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
	{ kind: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
	{ kind: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
	{ kind: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9]{32,}\b/ },
	{ kind: "Stripe key", pattern: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
	{ kind: "Private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
	{ kind: "JSON Web Token", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
	{ kind: "Database URL", pattern: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>]{8,}/i },
];

export interface SecretHit {
	kind: string;
	masked: string;
}

export function maskSecret(value: string): string {
	const trimmed = value.trim();
	if (trimmed.length <= 8) return "***";
	return `${trimmed.slice(0, 4)}…${trimmed.slice(-2)} (${trimmed.length} chars)`;
}

export function scanSecrets(values: Iterable<string>, limit = 6): SecretHit[] {
	const hits: SecretHit[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		if (value.length < 12 || value.length > 4096) continue;
		for (const candidate of SECRET_PATTERNS) {
			const match = candidate.pattern.exec(value);
			if (!match) continue;
			const key = `${candidate.kind}:${match[0].slice(0, 6)}`;
			if (seen.has(key)) continue;
			seen.add(key);
			hits.push({ kind: candidate.kind, masked: maskSecret(match[0]) });
			break;
		}
		if (hits.length >= limit) break;
	}
	return hits;
}
