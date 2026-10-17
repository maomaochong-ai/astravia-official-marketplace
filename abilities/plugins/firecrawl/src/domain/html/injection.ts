/**
 * Heuristic prompt-injection scan.
 *
 * firecrawl ships an LLM-based guard; a plugin should not silently spend model
 * tokens on every scrape, so this is a deliberately transparent keyword scan.
 * It flags *possible* injections and never alters the content — the caller
 * surfaces a warning badge and the raw excerpt.
 */

export interface ContentWarning {
	code: "PROMPT_INJECTION_SUSPECT";
	pattern: string;
	excerpt: string;
}

interface Probe {
	label: string;
	pattern: RegExp;
}

const PROBES: Probe[] = [
	{ label: "ignore-previous-instructions", pattern: /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|earlier)\b[^.\n]{0,40}\b(instructions?|prompts?|rules?)\b/i },
	{ label: "reveal-system-prompt", pattern: /\b(reveal|print|show|repeat|leak)\b[^.\n]{0,30}\b(system prompt|hidden instructions?|initial prompt)\b/i },
	{ label: "role-override", pattern: /\b(you are now|act as|pretend to be)\b[^.\n]{0,40}\b(assistant|ai|model|agent|admin|system)\b/i },
	{ label: "credential-exfiltration", pattern: /\b(send|share|post|upload|email)\b[^.\n]{0,40}\b(api[ _-]?key|password|token|credentials?|secret)\b/i },
	{ label: "hidden-from-user", pattern: /\b(do not|don't|never)\b[^.\n]{0,20}\b(tell|inform|mention|show)\b[^.\n]{0,20}\b(the )?(user|human)\b/i },
	{ label: "money-movement", pattern: /\b(transfer|wire|send)\b[^.\n]{0,20}(\$|usd|eur|btc|eth)\s?\d/i },
];

const EXCERPT_RADIUS = 60;

export function scanForInjection(text: string, limit = 3): ContentWarning[] {
	if (!text) return [];
	const warnings: ContentWarning[] = [];
	for (const probe of PROBES) {
		const match = probe.pattern.exec(text);
		if (!match) continue;
		const start = Math.max(0, match.index - EXCERPT_RADIUS);
		const excerpt = text
			.slice(start, match.index + match[0].length + EXCERPT_RADIUS)
			.replace(/\s+/g, " ")
			.trim();
		warnings.push({ code: "PROMPT_INJECTION_SUSPECT", pattern: probe.label, excerpt });
		if (warnings.length >= limit) break;
	}
	return warnings;
}
