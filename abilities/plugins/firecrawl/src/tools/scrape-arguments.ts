/**
 * JSON Schema fragments shared by the scrape-like tools.
 *
 * The same arguments reach `/v2/scrape`, `/v2/crawl` and `/v2/batch/scrape`, so
 * the schema lives here once and the tool modules only add what is specific.
 * Field names and bounds mirror the v2 OpenAPI `ScrapeOptions` schema; anything
 * upstream cannot express is deliberately absent.
 */

import { CRAWL_FORMAT_OPTIONS, FORMAT_OPTIONS } from "../domain/firecrawl/formats";

export const urlProperty = {
	type: "string",
	description: "Absolute http(s) URL of the page to read.",
} as const;

export const formatsProperty = {
	type: "array",
	items: { type: "string", enum: [...FORMAT_OPTIONS] },
	description: [
		"Outputs to return. Markdown is the default; add any of html, rawHtml, links, images, screenshot,",
		"screenshot@fullPage, summary, branding, product, menu, json, attributes, changeTracking, audio,",
		"video, media (audio + video), rawBase64. `media` and `screenshot@fullPage` are shorthands for",
		"upstream object formats. `rawBase64` returns the page itself and must be requested alone.",
		"json/attributes/question/highlights take their payload from `prompt`, `schema`, `attributes`,",
		"`question` and `highlights`.",
	].join(" "),
} as const;

/**
 * Crawls reuse the scrape schema but offer only the formats that make sense per
 * page — no screenshots or per-page payloads at crawl scale.
 */
export const crawlFormatsProperty = {
	type: "array",
	items: { type: "string", enum: [...CRAWL_FORMAT_OPTIONS] },
	description: [
		"Outputs to request for every crawled page. `markdown` is always kept; add links, images, media,",
		"summary, html, json or changeTracking. Defaults to markdown only.",
	],
} as const;

export const actionsProperty = {
	type: "array",
	maxItems: 10,
	description: [
		"Browser actions to run before capturing, in order. Each action is one object:",
		'{"type":"click","selector":"#more"} (optional "all": true), {"type":"write","text":"hello"}',
		'(writes into the focused element; add a click first to target one), {"type":"press","key":"Enter"}',
		'{"type":"scroll","direction":"down"}, {"type":"wait","milliseconds":1500} or',
		'{"type":"wait","selector":"#ready"}, {"type":"screenshot","fullPage":true}, {"type":"scrape"},',
		'{"type":"executeJavascript","script":"…"}, {"type":"pdf"}.',
	].join(" "),
	items: {
		type: "object",
		properties: {
			type: {
				type: "string",
				enum: ["click", "write", "fill", "press", "scroll", "wait", "screenshot", "scrape", "executeJavascript", "pdf"],
			},
			selector: { type: "string", description: "CSS selector for click, scroll, wait." },
			text: { type: "string", description: "Text for write." },
			key: { type: "string", description: 'Key or combination for press, e.g. "Enter".' },
			direction: { type: "string", enum: ["up", "down", "left", "right"] },
			milliseconds: { type: "number", description: "Wait duration (1-60000)." },
			script: { type: "string", description: "JavaScript for executeJavascript." },
			fullPage: { type: "boolean" },
			quality: { type: "number", description: "Screenshot quality, 1-100." },
			viewport: {
				type: "object",
				properties: { width: { type: "number" }, height: { type: "number" } },
				required: ["width", "height"],
			},
			format: { type: "string", description: 'PDF paper format, e.g. "A4".' },
			landscape: { type: "boolean" },
			scale: { type: "number", description: "PDF scale, 0.1-2." },
			all: { type: "boolean", description: "Click every match, not just the first." },
		},
		required: ["type"],
	},
} as const;

export const attributesProperty = {
	description:
		'Text or attribute values to lift from the page: ["h1", "a@href"] or [{"selector":"a","attribute":"href"}]. Adds formats: attributes.',
	oneOf: [
		{ type: "string" },
		{ type: "array", items: { type: "string" } },
		{
			type: "array",
			items: {
				type: "object",
				properties: { selector: { type: "string" }, attribute: { type: "string" } },
				required: ["selector"],
			},
		},
	],
} as const;

export const jsonProperties = {
	prompt: {
		type: "string",
		description: "Natural-language instruction for JSON extraction from this page (implies formats: json).",
	},
	schema: {
		type: "object",
		description: "JSON Schema the extracted object must follow; pair it with `prompt`.",
	},
} as const;

export const answerProperties = {
	question: {
		type: "string",
		description: "Ask a question about the page and return the answer (max 10000 characters). Implies formats: question.",
	},
	highlights: {
		type: "string",
		description: "Text-selection query; returns the matching source passages. Implies formats: highlights.",
	},
} as const;

export const captureProperties = {
	onlyMainContent: {
		type: "boolean",
		description: "Drop navigation, footers and sidebars. Default true.",
	},
	onlyCleanContent: {
		type: "boolean",
		description: "Keep only content the readability pass considers clean, dropping boilerplate.",
	},
	includeLinks: {
		type: "boolean",
		description: "Keep anchor tags in the returned HTML. Default true.",
	},
	includeTags: {
		type: "array",
		items: { type: "string" },
		description: "Only keep these CSS selectors (max 10).",
	},
	excludeTags: {
		type: "array",
		items: { type: "string" },
		description: "Remove these CSS selectors (max 10).",
	},
	removeBase64Images: {
		type: "boolean",
		description: "Replace inline base64 images with a placeholder. Default true.",
	},
	waitFor: {
		type: "number",
		description: "Milliseconds to wait for the page to settle before capturing (0-60000).",
	},
	timeoutMs: {
		type: "number",
		description: "Upstream request timeout in milliseconds (1000-300000).",
	},
	headers: {
		type: "object",
		description: "Extra request headers sent to the target site.",
	},
	headersJson: {
		type: "string",
		description: "Extra request headers as a JSON object string.",
	},
	maxAge: {
		type: "number",
		description: "Reuse a cached copy younger than this many milliseconds; 0 forces a fresh fetch.",
	},
	minAge: {
		type: "number",
		description: "Reject a cached copy younger than this many milliseconds; 0 accepts any cached copy.",
	},
	storeInCache: {
		type: "boolean",
		description: "Allow this result to be cached upstream. Default true.",
	},
	changeTracking: {
		type: "boolean",
		description: "Shorthand for formats: [\"changeTracking\"]. Returns a git-style diff against the previous capture of this URL.",
	},
	proxy: {
		type: "string",
		enum: ["basic", "enhanced", "auto"],
		description:
			"basic for ordinary sites, enhanced for advanced anti-bot protection (same credit cost, slower), auto to retry with enhanced after a basic failure. Default auto.",
	},
	mobile: {
		type: "boolean",
		description: "Emulate a mobile device.",
	},
	skipTlsVerification: {
		type: "boolean",
		description: "Skip TLS certificate verification on the target site.",
	},
	blockAds: {
		type: "boolean",
		description: "Block ads and popups. Default true upstream; set false only when the page needs them.",
	},
	lockdown: {
		type: "boolean",
		description: "Only load the target page's own origin; stricter sandboxing for untrusted sites.",
	},
	checkPromptInjection: {
		type: "boolean",
		description: "Flag content that tries to manipulate the model reading it.",
	},
	redactPII: {
		type: "boolean",
		description: "Redact emails, phone numbers and similar personal data from the returned Markdown.",
	},
	profile: {
		type: "string",
		description: "Named browser profile (cookies, localStorage). Scrapes and interact sessions sharing the name share state.",
	},
	saveProfile: {
		type: "boolean",
		description: "Write browser state back to `profile` after this request. Default true.",
	},
	zeroDataRetention: {
		type: "boolean",
		description: "Request zero data retention for this call. Requires the feature to be enabled on the account.",
	},
	location: {
		type: "string",
		description: "Two-letter country code used for geo-targeted requests.",
	},
	parsers: {
		type: "array",
		items: { type: "string", enum: ["pdf", "image"] },
		description: 'Document parsers to run, e.g. ["pdf", "image"]. Omit to leave upstream defaults on.',
	},
} as const;

export const scrapeProperties = {
	...captureProperties,
	formats: formatsProperty,
	actions: actionsProperty,
	attributes: attributesProperty,
	...jsonProperties,
	...answerProperties,
} as const;

export const crawlProperties = {
	...captureProperties,
	formats: crawlFormatsProperty,
	limit: {
		type: "number",
		description: "Maximum number of pages to crawl (1-10000). Default 25.",
	},
	maxDepth: {
		type: "number",
		description: "How many link levels below the start URL to follow (0-20). Default 2.",
	},
	maxConcurrency: {
		type: "number",
		description: "Concurrent page fetches (1-10). Lower it if the site rate-limits you.",
	},
	delay: {
		type: "number",
		description: "Milliseconds to wait between page fetches (0-5000).",
	},
	sitemap: {
		type: "string",
		enum: ["include", "only", "skip"],
		description: "Use the site's sitemap to discover URLs. Default include.",
	},
	includePaths: {
		type: "array",
		items: { type: "string" },
		description: "Only crawl URLs matching these path patterns.",
	},
	excludePaths: {
		type: "array",
		items: { type: "string" },
		description: "Skip URLs matching these path patterns.",
	},
	prompt: {
		type: "string",
		description: "Natural-language description of what to find; steers which pages the crawler follows.",
	},
	ignoreQueryParameters: {
		type: "boolean",
		description: "Treat URLs differing only in query string as one page. Default true.",
	},
	allowExternalLinks: {
		type: "boolean",
		description: "Follow links to other domains. Default false.",
	},
	allowSubdomains: {
		type: "boolean",
		description: "Follow links to subdomains of the start host. Default false.",
	},
	crawlEntireDomain: {
		type: "boolean",
		description: "Follow sibling and parent paths, not just children of the start URL. Default false.",
	},
	ignoreRobotsTxt: {
		type: "boolean",
		description: "Ignore robots.txt rules. Only set when the user owns the site or has permission.",
	},
	webhookUrl: {
		type: "string",
		description: "HTTPS endpoint that receives crawl completion and page events.",
	},
} as const;
