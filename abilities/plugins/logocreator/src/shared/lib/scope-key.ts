/**
 * Conversation scope key.
 *
 * Every piece of plugin state that can reach the *wrong* conversation is keyed by
 * this string. The host already isolates its own per-session state (`sessionInput
 * ActionStateMapAtom`, tab attach records, `openActivityTab({cwd})`); the plugin's
 * own cross-talk channels have to do the same or two open panels will hand each
 * other their work.
 *
 * Normalisation matters: `/repo/a/` and `\repo\A` are the same project on Windows,
 * and a scope key that differs by a trailing slash splits one conversation's state
 * into two.
 */

const GLOBAL = "__global__";

export function scopeKey(cwd: string | null | undefined): string {
	if (typeof cwd !== "string") return GLOBAL;
	const normalized = cwd.trim().replace(/\\/g, "/").replace(/\/+$/, "");
	if (!normalized) return GLOBAL;
	// Windows paths are case-insensitive; POSIX paths are not.
	const isWindows = /^[a-z]:\//i.test(normalized) || normalized.startsWith("//");
	return isWindows ? normalized.toLowerCase() : normalized;
}
