/**
 * Single source of truth for "what the crawler is doing right now".
 *
 * The store is created once per plugin activation and shared by the tool
 * handlers and the activity tab, so a crawl started from the conversation
 * animates the console the user has open — and a crawl started from the console
 * is the same code path the agent calls.
 */

import type { CrawlEvent, CrawlOptions, CrawlSummary } from "../../../domain/events";
import { urlLabel } from "../../../domain/url";
import { formatBytes, formatCount, formatDuration, truncate } from "../../../shared/formatters/format";

export type NodeState = "queued" | "fetching" | "crawled" | "denied" | "failed";

export interface CrawlNodeView {
	id: string;
	url: string;
	label: string;
	depth: number;
	parentId: string | null;
	state: NodeState;
	code?: string;
	title?: string;
	chars?: number;
	durationMs?: number;
}

export type ConsoleLevel = "info" | "ok" | "warn" | "error" | "deny";

export interface ConsoleLine {
	id: number;
	at: number;
	level: ConsoleLevel;
	text: string;
}

export interface CrawlCounts {
	crawled: number;
	fetching: number;
	queued: number;
	denied: number;
	failed: number;
	discovered: number;
}

export interface CrawlRunSnapshot {
	runId: string | null;
	status: "idle" | "running" | "completed" | "stopped" | "failed";
	target: string;
	options: CrawlOptions | null;
	startedAt: number;
	endedAt: number | null;
	nodes: CrawlNodeView[];
	counts: CrawlCounts;
	denialsByCode: Record<string, number>;
	bytes: number;
	chars: number;
	lines: ConsoleLine[];
	pages: Array<{ url: string; title: string; chars: number; depth: number }>;
	robots: { present: boolean; status: number; rules: number; sitemaps: number; failedOpen: boolean } | null;
	sitemap: { fetched: number; urls: number; truncated: boolean } | null;
	lastError: string | null;
}

export type CrawlRunner = (
	target: string,
	options: CrawlOptions,
	hooks: { onEvent: (event: CrawlEvent) => void; signal: AbortSignal },
) => Promise<CrawlSummary>;

const MAX_NODES = 180;
const MAX_LINES = 400;
const MAX_PAGES = 200;

function emptySnapshot(): CrawlRunSnapshot {
	return {
		runId: null,
		status: "idle",
		target: "",
		options: null,
		startedAt: 0,
		endedAt: null,
		nodes: [],
		counts: { crawled: 0, fetching: 0, queued: 0, denied: 0, failed: 0, discovered: 0 },
		denialsByCode: {},
		bytes: 0,
		chars: 0,
		lines: [],
		pages: [],
		robots: null,
		sitemap: null,
		lastError: null,
	};
}

export class CrawlRunStore {
	private snapshot: CrawlRunSnapshot = emptySnapshot();
	private listeners = new Set<() => void>();
	private controller: AbortController | null = null;
	private lineId = 0;
	private runSeq = 0;
	private nodesTruncated = false;

	constructor(private readonly runner: CrawlRunner) {}

	getSnapshot = (): CrawlRunSnapshot => this.snapshot;

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	get running(): boolean {
		return this.snapshot.status === "running";
	}

	get nodesTruncatedFlag(): boolean {
		return this.nodesTruncated;
	}

	stop(): void {
		this.controller?.abort();
	}

	/** Writes a console line for work done outside a crawl (scrape / map). */
	note(level: ConsoleLevel, text: string): void {
		this.pushLine(level, text);
		this.emit();
	}

	/** Starts a crawl unless one is already running. */
	async start(target: string, options: CrawlOptions): Promise<CrawlSummary> {
		if (this.running) {
			throw new Error("A crawl is already running — stop it first");
		}
		this.runSeq += 1;
		const runId = `run-${Date.now().toString(36)}-${this.runSeq}`;
		this.controller = new AbortController();
		this.lineId = 0;
		this.nodesTruncated = false;
		this.snapshot = { ...emptySnapshot(), runId, status: "running", target, options, startedAt: Date.now() };
		this.pushLine(
			"info",
			`run start  ${target}  limit=${options.limit} depth=${options.maxDepth} concurrency=${options.concurrency}`,
		);
		this.emit();

		try {
			const summary = await this.runner(target, options, {
				onEvent: (event) => this.ingest(event),
				signal: this.controller.signal,
			});
			this.snapshot = {
				...this.snapshot,
				status: summary.status,
				endedAt: Date.now(),
				counts: { ...this.snapshot.counts, fetching: 0, crawled: summary.pages.length, denied: summary.denied.length },
			};
			this.emit();
			return summary;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.snapshot = { ...this.snapshot, status: "failed", endedAt: Date.now(), lastError: message };
			this.pushLine("error", `run failed  ${message}`);
			this.emit();
			throw error;
		} finally {
			this.controller = null;
		}
	}

	ingest(event: CrawlEvent): void {
		switch (event.type) {
			case "run-start":
				return;
			case "robots":
				this.snapshot = {
					...this.snapshot,
					robots: {
						present: event.present,
						status: event.status,
						rules: event.rules,
						sitemaps: event.sitemaps,
						failedOpen: event.failedOpen,
					},
				};
				this.pushLine(
					event.failedOpen ? "warn" : "info",
					`robots.txt  ${event.status || "unreachable"}  ${event.rules} rules  ${
						event.crawlDelayMs ? `crawl-delay ${formatDuration(event.crawlDelayMs)}` : "no crawl-delay"
					}  sitemaps=${event.sitemaps}${event.failedOpen ? "  (failed open)" : ""}`,
				);
				break;
			case "sitemap":
				this.snapshot = {
					...this.snapshot,
					sitemap: { fetched: event.fetched, urls: event.urls, truncated: event.truncated },
				};
				this.pushLine(
					"info",
					`sitemap  ${event.fetched} file(s)  ${event.urls} urls${event.truncated ? "  (truncated)" : ""}`,
				);
				break;
			case "queued":
				this.transition(event.url, event.depth, event.parent, "queued");
				this.pushLine("info", `queued  ${pathOf(event.url)}  depth=${event.depth}  via ${event.via}`);
				break;
			case "fetching":
				this.transition(event.url, event.depth, event.parent, "fetching");
				break;
			case "crawled":
				this.transition(event.url, event.depth, event.parent, "crawled", {
					title: event.title,
					chars: event.chars,
					durationMs: event.durationMs,
				});
				this.snapshot = {
					...this.snapshot,
					bytes: this.snapshot.bytes + event.bytes,
					chars: this.snapshot.chars + event.chars,
					pages: [
						...this.snapshot.pages,
						{ url: event.url, title: event.title, chars: event.chars, depth: event.depth },
					].slice(-MAX_PAGES),
				};
				this.pushLine(
					"ok",
					`GET  ${event.status}  ${pathOf(event.url)}  ${formatBytes(event.bytes)}  engine=${event.engine}  ${formatDuration(
						event.durationMs,
					)}  links=${event.links}  chars=${formatCount(event.chars)}`,
				);
				break;
			case "denied":
				this.transition(event.url, event.depth, event.parent, "denied", { code: event.code }, true);
				this.pushLine("deny", `deny  ${pathOf(event.url)}  ${event.code}  ${truncate(event.message, 110)}`);
				break;
			case "failed":
				this.transition(event.url, event.depth, event.parent, "failed", { code: event.code }, true);
				this.snapshot = { ...this.snapshot, lastError: event.message };
				this.pushLine("error", `fail  ${pathOf(event.url)}  ${event.code}  ${truncate(event.message, 130)}`);
				break;
			case "engine-fallback":
				this.pushLine("warn", `engine  ${event.from} → ${event.to}  ${truncate(event.reason, 110)}`);
				break;
			case "run-end":
				this.snapshot = {
					...this.snapshot,
					status: event.status,
					endedAt: event.at,
					counts: { ...this.snapshot.counts, fetching: 0 },
				};
				this.pushLine(
					event.status === "completed" ? "ok" : "warn",
					`run end  ${event.status}  pages=${event.crawled}  denied=${event.denied}  failed=${event.failed}  discovered=${event.discovered}  ${formatDuration(
						event.durationMs,
					)}`,
				);
				break;
		}
		this.emit();
	}

	/** Applies one node state change and keeps the counters exact. */
	private transition(
		url: string,
		depth: number,
		parent: string | null,
		state: NodeState,
		extra: Partial<CrawlNodeView> = {},
		countAsNew = false,
	): void {
		const nodes = this.snapshot.nodes;
		const index = nodes.findIndex((node) => node.id === url);
		const counts = { ...this.snapshot.counts };
		const previousState = index === -1 ? null : nodes[index].state;
		if (previousState === state) return;
		if (previousState) {
			if (previousState === "queued") counts.queued = Math.max(0, counts.queued - 1);
			if (previousState === "fetching") counts.fetching = Math.max(0, counts.fetching - 1);
			if (previousState === "crawled") counts.crawled = Math.max(0, counts.crawled - 1);
			if (previousState === "denied") counts.denied = Math.max(0, counts.denied - 1);
			if (previousState === "failed") counts.failed = Math.max(0, counts.failed - 1);
		}
		if (state === "queued") counts.queued += 1;
		if (state === "fetching") counts.fetching += 1;
		if (state === "crawled") counts.crawled += 1;
		if (state === "denied") counts.denied += 1;
		if (state === "failed") counts.failed += 1;
		if (countAsNew || index === -1) counts.discovered = Math.max(counts.discovered, counts.crawled + counts.denied + counts.failed + counts.queued + counts.fetching);

		let nextNodes = nodes;
		if (index === -1) {
			if (nodes.length >= MAX_NODES) {
				this.nodesTruncated = true;
			} else {
				nextNodes = [
					...nodes,
					{ id: url, url, label: urlLabel(url), depth, parentId: parent, state, ...extra },
				];
			}
		} else {
			nextNodes = nodes.slice();
			nextNodes[index] = { ...nextNodes[index], state, ...extra };
		}

		const denialsByCode =
			state === "denied" && extra.code
				? { ...this.snapshot.denialsByCode, [extra.code]: (this.snapshot.denialsByCode[extra.code] ?? 0) + 1 }
				: this.snapshot.denialsByCode;

		this.snapshot = { ...this.snapshot, nodes: nextNodes, counts, denialsByCode };
	}

	private pushLine(level: ConsoleLevel, text: string): void {
		this.lineId += 1;
		const line: ConsoleLine = { id: this.lineId, at: Date.now(), level, text };
		this.snapshot = { ...this.snapshot, lines: [...this.snapshot.lines, line].slice(-MAX_LINES) };
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
}

function pathOf(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.pathname}${parsed.search}`.slice(0, 64);
	} catch {
		return url.slice(0, 64);
	}
}
