/**
 * Why a discovered link was not crawled.
 *
 * The taxonomy follows firecrawl's `DenialReason` enum so the console speaks the
 * same vocabulary as a server-side crawl; messages are rewritten to be short
 * enough for one console line plus an expandable detail.
 */

export const DENIAL_CODES = [
	"DEPTH_LIMIT",
	"EXCLUDE_PATTERN",
	"INCLUDE_PATTERN",
	"ROBOTS_TXT",
	"FILE_TYPE",
	"URL_PARSE_ERROR",
	"BACKWARD_CRAWLING",
	"SOCIAL_MEDIA",
	"EXTERNAL_LINK",
	"SECTION_LINK",
	"NON_WEB_PROTOCOL",
	"DUPLICATE",
	"ALREADY_CRAWLED",
	"LIMIT_REACHED",
] as const;

export type DenialCode = (typeof DENIAL_CODES)[number];

export interface DenialContext {
	url: string;
	depth?: number;
	maxDepth?: number;
	pattern?: string;
	patterns?: readonly string[];
	scope?: string;
	extension?: string;
}

const MESSAGES: Record<DenialCode, (context: DenialContext) => string> = {
	DEPTH_LIMIT: (c) =>
		`depth ${c.depth ?? "?"} exceeds maxDepth ${c.maxDepth ?? "?"} — raise maxDepth to crawl it`,
	EXCLUDE_PATTERN: (c) =>
		`path matches excludePaths pattern "${c.pattern ?? "?"}" — adjust excludePaths to crawl it`,
	INCLUDE_PATTERN: (c) =>
		`path matches none of includePaths [${(c.patterns ?? []).map((p) => `"${p}"`).join(", ")}] — add a matching pattern`,
	ROBOTS_TXT: () => "disallowed by robots.txt — this crawler respects it unless you turn that off",
	FILE_TYPE: (c) =>
		`".${c.extension ?? "?"}" is not a page the crawler reads (images, media, archives, assets)`,
	URL_PARSE_ERROR: () => "not a valid absolute http(s) URL",
	BACKWARD_CRAWLING: (c) =>
		`outside the start scope (${c.scope ?? "?"}) — enable backward crawling to leave it`,
	SOCIAL_MEDIA: () => "social media or mail link — skipped by default",
	EXTERNAL_LINK: () => "different site than the target — enable external links to follow it",
	SECTION_LINK: () => "section anchor (#) of a page already queued — the page itself is crawled once",
	NON_WEB_PROTOCOL: () => "non-web protocol (mailto:, tel:, ftp: …) — only http(s) is scrapable",
	DUPLICATE: () => "already discovered in this run",
	ALREADY_CRAWLED: () => "already crawled in this run",
	LIMIT_REACHED: () => "crawl limit reached — raise limit to continue",
};

export function describeDenial(code: DenialCode, context: DenialContext): string {
	return MESSAGES[code](context);
}

export interface DenialVerdict {
	code: DenialCode;
	message: string;
}

export function denial(code: DenialCode, context: DenialContext): DenialVerdict {
	return { code, message: describeDenial(code, context) };
}
