/**
 * What the launch prompt means.
 *
 * Upstream's start screen treats the prompt the way a coding agent treats one:
 * every whitespace-delimited token that names something scannable becomes a
 * target, and anything left over becomes the scan instruction (setup.go:
 * submitSetupPrompt). Reimplemented here rather than approximated, because the
 * two readings - "scan this host" and "scan with this method" - decide whether
 * the sandbox gets a target list at all.
 */

export interface LaunchRequest {
	/** Scannable tokens found in the prompt, de-duplicated, in the order given. */
	targets: string[];
	/** The whole prompt when it carried more than just targets; otherwise "". */
	instruction: string;
}

const DOMAIN = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9]{2,}$/;

function isNumeric(value: string): boolean {
	return /^\d+$/.test(value);
}

/** A URL, repo, filesystem path, domain, or IP: something the sandbox can point at. */
export function looksLikeTarget(token: string): boolean {
	if (!token) return false;
	if (token.includes("://") || token.endsWith(".git")) return true;
	if (/^(\/|\.\/|~\/|\.\.\/)/.test(token)) return true;
	if (/^\d{1,3}(\.\d{1,3}){3}$/.test(token)) return true;

	// A URL authority may carry credentials and a port; the host is what is matched.
	const host = token.split("@").pop()?.split("/")[0]?.split(":")[0] ?? "";
	if (!DOMAIN.test(host)) return false;
	const tld = host.slice(host.lastIndexOf(".") + 1);
	return tld.length >= 2 && !isNumeric(tld);
}

export function parseLaunchPrompt(value: string, known: readonly string[] = []): LaunchRequest {
	const fields = value.split(/\s+/).filter(Boolean);
	const seen = new Set(known);
	const targets: string[] = [];
	for (const field of fields) {
		const token = field.replace(/[,;]+$/, "");
		if (!looksLikeTarget(token) || seen.has(token)) continue;
		seen.add(token);
		targets.push(token);
	}
	// Upstream compares the field count with the number of targets it accepted, so a
	// prompt made only of already-added targets still reads as "targets only".
	const instruction = fields.length > targets.length ? value.trim() : "";
	return { targets, instruction };
}
