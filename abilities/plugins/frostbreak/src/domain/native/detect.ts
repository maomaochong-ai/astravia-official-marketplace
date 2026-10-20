import { looksLikeMacho, parseMacho } from "./macho";
import { looksLikeElf, parseElf } from "./elf";
import { looksLikePe, parsePe } from "./pe";
import type { NativeFacts, Parsed } from "./types";

/** 只做格式判别，不重复 triage 的完整审计。 */
export function readNativeFacts(bytes: Uint8Array): Parsed<NativeFacts> | null {
	if (looksLikeElf(bytes)) return parseElf(bytes);
	if (looksLikePe(bytes)) return parsePe(bytes);
	if (looksLikeMacho(bytes)) return parseMacho(bytes);
	return null;
}
