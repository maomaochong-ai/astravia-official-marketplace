import {
	DESTINATIONS,
	boardmixUrlOf,
	type DestinationKey,
} from "../../../domain/boardmix-destinations";

export type EntryTarget =
	| { kind: "destination"; key: DestinationKey }
	| { kind: "url"; url: string };

export type EntryRejection = "origin-not-allowed" | "invalid-url";

export type EntryResolution =
	| { ok: true; url: string }
	| { ok: false; reason: EntryRejection };

/**
 * 唯一一道 origin 闸门：界面的首次导航、`boardmix_goto`、`boardmix_new`、
 * `boardmix_ai` 全走这里。往里加能力的成本必须高于绕过它的成本。
 */
export function resolveEntryTarget(target: EntryTarget): EntryResolution {
	if (target.kind === "destination") {
		const url = DESTINATIONS[target.key];
		return url ? { ok: true, url } : { ok: false, reason: "invalid-url" };
	}
	const raw = typeof target.url === "string" ? target.url.trim() : "";
	if (!raw) return { ok: false, reason: "invalid-url" };
	const parsed = boardmixUrlOf(raw);
	if (!parsed) {
		// 能构成 URL 但域名不对 → origin 拒绝；连 URL 都不是 → 输入问题。
		const looksLikeUrl = /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.includes(".");
		return { ok: false, reason: looksLikeUrl ? "origin-not-allowed" : "invalid-url" };
	}
	return { ok: true, url: parsed.toString() };
}

export function destinationUrl(key: DestinationKey): string {
	return DESTINATIONS[key];
}
