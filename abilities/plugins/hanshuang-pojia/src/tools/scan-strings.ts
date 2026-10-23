import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { compilePattern, extractStrings } from "../domain/strings";
import { loadSample } from "./read-sample";
import { publishToolResult } from "../runtime/panel-channel";

interface ScanStringsInput {
	path?: string;
	query?: string;
	minLength?: number;
	maxResults?: number;
	encoding?: "ascii" | "utf16le" | "both";
}

const MAX_RESULTS_CAP = 500;

function quote(value: string): string {
	const trimmed = value.length > 180 ? `${value.slice(0, 179)}…` : value;
	return trimmed.replace(/\|/g, "\\|");
}

export function registerScanStringsTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<ScanStringsInput>({
		id: "scan_binary_strings",
		name: "scan_binary_strings",
		label: "%tool.strings.label%",
		description: [
			"Extract printable strings from a binary or package and optionally filter them with a plain",
			"text or regular expression query. Returns offsets so a later step can map a hit back to a",
			"section or archive entry.",
			"",
			"Use it to look for URLs, hosts, API endpoints, library names, SDK markers, error messages,",
			"embedded paths or asserted secrets inside an APK, DEX, ELF, PE, Mach-O or ZIP sample.",
			"",
			"It scans at most 24 MiB per call starting at offset 0 and truncates long strings; wide",
			"(UTF-16LE) strings are only included when requested. Do NOT use it as a full-text search",
			"engine over source trees — read the files instead.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "File path, absolute or relative to the session working directory." },
				query: {
					type: "string",
					description: "Optional plain text or regular expression; match is case-insensitive unless the pattern starts with (?-i).",
				},
				minLength: { type: "integer", description: "Minimum string length (default 6, min 4)." },
				maxResults: { type: "integer", description: `Maximum hits to return (default 80, max ${MAX_RESULTS_CAP}).` },
				encoding: {
					type: "string",
					enum: ["ascii", "utf16le", "both"],
					description: "Which encodings to scan (default ascii).",
				},
			},
			required: ["path"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 120_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const sample = await loadSample(context.host.fs, context.session.cwd, input.path ?? "");
				const encoding = input.encoding ?? "ascii";
				const minLength = Math.max(4, Math.min(64, input.minLength ?? 6));
				const maxResults = Math.max(1, Math.min(MAX_RESULTS_CAP, input.maxResults ?? 80));
				const scanned = extractStrings(sample.bytes, {
					minLength,
					maxResults: 20_000,
					encodings: encoding === "both" ? ["ascii", "utf16le"] : [encoding],
				});
				const query = (input.query ?? "").trim();
				const matcher = query.length > 0 ? compilePattern(query) : null;
				const hits = (matcher ? scanned.filter(item => matcher.test(item.value)) : scanned).slice(0, maxResults);
				publishToolResult({
					toolId: "scan_binary_strings",
					kind: "strings",
					target: sample.path,
					summary:
						hits.length > 0
							? `${hits.length} string(s)${query ? ` for "${query}"` : ""} in ${sample.name} (${scanned.length} scanned)`
							: `No strings matched${query ? ` "${query}"` : ""} in ${sample.name} (${scanned.length} scanned)`,
					payload: {
						name: sample.name,
						query: query || null,
						scanned: scanned.length,
						hits: hits.slice(0, 30).map(hit => ({ offset: `0x${hit.offset.toString(16)}`, encoding: hit.encoding, value: hit.value.slice(0, 80) })),
						total: hits.length,
					},
				});
				if (hits.length === 0) {
					return `No strings matched ${query ? `"${query}"` : "the scan"} in ${sample.name} (${scanned.length} candidate strings scanned).`;
				}
				const rows = hits.map(item => `| 0x${item.offset.toString(16)} | ${item.encoding} | ${quote(item.value)} |`);
				return [
					`# Strings in ${sample.name}`,
					"",
					`${hits.length} hit(s)${query ? ` for \`${query}\`` : ""} out of ${scanned.length} candidate strings. Offsets are file offsets.`,
					"",
					"| offset | encoding | value |",
					"| --- | --- | --- |",
					...rows,
					"",
					"Evidence only — a string being present does not prove the surrounding logic is reachable.",
				].join("\n");
			} catch (error) {
				return `String scan failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}
