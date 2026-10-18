/**
 * Single source of truth for "what the crawler is doing right now".
 *
 * A crawl is an upstream job: `POST /v2/crawl` returns an id, the console polls
 * it and paints pages as they arrive. The store therefore holds a job id rather
 * than a local crawl loop, and a crawl started by a tool can be adopted by the
 * console so both views describe the same run.
 */

import { readJobPages } from "../../../domain/firecrawl/client";
import {
	MAX_ARTIFACTS,
	type ArtifactKind,
	type CrawlArtifact,
	pageArtifacts,
} from "../../../domain/firecrawl/artifacts";
import type { FirecrawlDocument, JobKind, JobStatus } from "../../../domain/firecrawl/types";
import type { RunArchive, RunSummary } from "./run-archive";
import type { CrawlJobOptions } from "../../../domain/firecrawl/options";
import { crawlJobBody, pathDepth, urlLabel } from "../../../domain/firecrawl/options";
import type { ElementProfile, ElementTotals } from "../../../domain/firecrawl/profile";
import { addProfile, EMPTY_ELEMENT_TOTALS, profileDocument } from "../../../domain/firecrawl/profile";
import { getPluginContext, hasPluginContext } from "../../../runtime/plugin-context";
import type { FirecrawlConfig } from "../../../runtime/config";
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
	elements?: ElementProfile;
}

export type ConsoleLevel = "info" | "ok" | "warn" | "error" | "deny";

/**
 * What a console line is about, so the rail can be scanned by category instead
 * of read line by line. The text stays free-form: the badge classifies, it does
 * not replace the message.
 */
export type ConsoleKind = "run" | "queue" | "get" | "deny" | "fail" | "note";

export interface ConsoleLine {
	id: number;
	at: number;
	level: ConsoleLevel;
	kind: ConsoleKind;
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

export interface CrawlPageView {
	url: string;
	title: string;
	chars: number;
	depth: number;
	status: number;
	finalUrl?: string;
	linkCount?: number;
	bytes?: number;
	durationMs?: number;
	/** Truncated page text, so the console can preview what was actually captured. */
	markdown?: string;
	elements?: ElementProfile;
}

export interface CrawlRunSnapshot {
	runId: string | null;
	/** Upstream crawl id; null until the API answers with one. */
	jobId: string | null;
	status: "idle" | "running" | "completed" | "stopped" | "failed";
	target: string;
	/** How the target got there: typed here, lifted from the conversation, or set by a tool call. */
	targetSource: "none" | "manual" | "conversation" | "tool";
	options: CrawlJobOptions | null;
	startedAt: number;
	endedAt: number | null;
	nodes: CrawlNodeView[];
	counts: CrawlCounts;
	denialsByCode: Record<string, number>;
	bytes: number;
	chars: number;
	lines: ConsoleLine[];
	pages: CrawlPageView[];
	elements: ElementTotals;
	/** What this run produced, split by type; the shelf and the archive read from here. */
	artifacts: CrawlArtifact[];
	/** Newest page arrivals, so the web can animate what just landed. */
	arrivals: Arrival[];
	/** Finished runs on disk, newest first. Empty until `loadHistory()` resolves. */
	history: RunSummary[];
	/** True when the shot came from storage: controls are live, nothing is being polled. */
	archived: boolean;
	creditsUsed: number | null;
	expiresAt: string | null;
	lastError: string | null;
}

export interface Arrival {
	url: string;
	kinds: ArtifactKind[];
	at: number;
}

const MAX_NODES = 180;
const MAX_LINES = 400;
const MAX_PAGES = 200;
/** Markdown kept per page for the console preview. The full text lives in the tool result. */
const MAX_PAGE_DOCUMENT_CHARS = 24_000;
/** Total markdown the snapshot may retain, across pages. */
const MAX_DOCUMENT_CHARS = 400_000;
/** Poll cadence while the job is `scraping`. */
const TICK_MS = 2_500;
/** Widest gap between polls once the upstream bucket starts refusing them. */
const MAX_TICK_MS = 30_000;
/** Consecutive failed polls after which the watch gives up on the status endpoint. */
const MAX_POLL_FAILURES = 8;
/** A crawl can legitimately run for hours; the console stops watching after this. */
const MAX_WATCH_MS = 30 * 60_000;
/** Arrival marks kept for the web animation; more than this reads as noise. */
const MAX_ARRIVALS = 10;

function emptySnapshot(): CrawlRunSnapshot {
	return {
		runId: null,
		jobId: null,
		status: "idle",
		target: "",
		targetSource: "none",
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
		elements: { ...EMPTY_ELEMENT_TOTALS, media: [] },
		creditsUsed: null,
		artifacts: [],
		arrivals: [],
		history: [],
		archived: false,
		expiresAt: null,
		lastError: null,
	};
}

export class CrawlRunStore {
	private snapshot: CrawlRunSnapshot = emptySnapshot();
	private listeners = new Set<() => void>();
	private lineId = 0;
	private runSeq = 0;
	private nodesTruncated = false;
	private watching = false;
	private stopped = false;

	constructor(
		private readonly config: FirecrawlConfig,
		/** Optional: without storage the console still runs, it just forgets finished runs. */
		private readonly archive: RunArchive | null = null,
	) {}

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

	/** True when a detected URL differs from what the console is already showing. */
	get targetIsStale(): boolean {
		return this.snapshot.status === "completed" || this.snapshot.status === "stopped";
	}

	/** Cancels the upstream job; the console keeps what it already collected. */
	stop(): void {
		this.stopped = true;
		const jobId = this.snapshot.jobId;
		if (jobId) {
			void this.config.maybeClient?.cancel("crawl", jobId).catch(() => undefined);
		}
		if (this.snapshot.status === "running") {
			this.snapshot = { ...this.snapshot, status: "stopped", endedAt: Date.now(), counts: { ...this.snapshot.counts, fetching: 0 } };
			this.pushLine("warn", "run stopped by user", "run");
			this.emit();
			void this.persist();
		}
	}

	/** Writes a console line for work done outside a crawl (scrape / map / parse). */
	note(level: ConsoleLevel, text: string): void {
		this.pushLine(level, text, "note");
		this.emit();
	}

	/** Mirrors a tool's wait loop into the console counters. */
	progress(completed: number, total: number): void {
		if (!this.watching) return;
		const counts = {
			...this.snapshot.counts,
			crawled: completed,
			queued: Math.max(0, total - completed),
			discovered: Math.max(this.snapshot.counts.discovered, total),
		};
		this.snapshot = { ...this.snapshot, counts };
		this.emit();
	}

	/**
	 * Records where the user (or a tool) pointed the crawler, without starting it.
	 *
	 * A running crawl owns its target: overwriting it mid-run would make the
	 * console describe a different page than the one being fetched.
	 */
	setTarget(url: string, source: "manual" | "conversation" | "tool"): void {
		if (this.running || !url) return;
		if (this.snapshot.target === url && this.snapshot.targetSource === source) return;
		this.snapshot = { ...this.snapshot, target: url, targetSource: source };
		this.emit();
	}

	/** Starts a crawl from the console and follows it to the end. */
	async start(target: string, options: CrawlJobOptions): Promise<void> {
		if (this.running) throw new Error("A crawl is already running — stop it first");
		const client = await this.config.require();
		const body = crawlJobBody(target, options);
		this.begin(target, options, this.snapshot.targetSource === "none" ? "manual" : this.snapshot.targetSource);
		this.pushLine(
			"info",
			`run start  ${target}  limit=${options.limit} depth=${options.maxDiscoveryDepth} concurrency=${options.maxConcurrency}`,
			"run",
		);
		this.emit();

		let handle;
		try {
			handle = await client.crawl(body);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.snapshot = { ...this.snapshot, status: "failed", endedAt: Date.now(), lastError: message };
			this.pushLine("error", `run failed  ${message}`, "run");
			this.emit();
			throw error;
		}

		this.snapshot = { ...this.snapshot, jobId: handle.id };
		this.pushLine("info", `job  ${handle.id}`, "run");
		this.emit();
		await this.watch("crawl", handle.id);
	}

	/**
	 * Follows a job started elsewhere (a tool call), so the console animates the
	 * same run instead of showing an idle panel.
	 */
	adopt(jobId: string, target: string): void {
		if (this.snapshot.jobId === jobId) return;
		if (this.running && !this.stopped) return;
		this.begin(target, this.snapshot.options ?? null, "tool");
		this.snapshot = { ...this.snapshot, jobId };
		this.pushLine("info", `run start  ${target}  (started by a tool)  job=${jobId}`, "run");
		this.emit();
		void this.watch("crawl", jobId).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			this.snapshot = { ...this.snapshot, status: "failed", endedAt: Date.now(), lastError: message };
			this.pushLine("error", `run failed  ${message}`, "run");
			this.emit();
		});
	}

	private begin(target: string, options: CrawlJobOptions | null, source: CrawlRunSnapshot["targetSource"]): void {
		this.runSeq += 1;
		this.lineId = 0;
		this.nodesTruncated = false;
		this.stopped = false;
		this.watching = true;
		this.snapshot = {
			...emptySnapshot(),
			// The shelf outlives a run: a new crawl replaces the shot, not the history.
			history: this.snapshot.history,
			runId: `run-${Date.now().toString(36)}-${this.runSeq}`,
			status: "running",
			target,
			targetSource: source,
			options,
			startedAt: Date.now(),
		};
	}

	/**
	 * Polls a job to completion, painting every page it has not seen yet.
	 *
	 * A poll can fail on its own — a 429 while the upstream bucket refills, a
	 * dropped connection — and a crawl that is still running upstream must not be
	 * reported as failed because of it. Failed polls widen the gap and retry, and
	 * once the watch ends the pages are read anyway: the run is closed out on what
	 * upstream actually has, not on the last response that happened to arrive.
	 */
	private async watch(kind: JobKind, jobId: string): Promise<void> {
		const client = await this.config.require();
		const deadline = Date.now() + MAX_WATCH_MS;
		const seen = new Set(this.snapshot.pages.map((page) => page.url));
		let interval = TICK_MS;
		let failures = 0;
		let lastFailure: string | null = null;

		const poll = async (): Promise<JobStatus | null> => {
			try {
				const next = await client.job(kind, jobId);
				failures = 0;
				interval = TICK_MS;
				this.apply(next, seen);
				return next;
			} catch (error) {
				lastFailure = error instanceof Error ? error.message : String(error);
				failures += 1;
				interval = Math.min(MAX_TICK_MS, interval * 2);
				this.pushLine("warn", `poll  retry ${failures}  ${lastFailure}`, "queue");
				this.emit();
				return null;
			}
		};

		let status = await poll();
		while (
			(status === null || status.status === "scraping") &&
			!this.stopped &&
			Date.now() < deadline &&
			failures < MAX_POLL_FAILURES
		) {
			await new Promise((resolve) => setTimeout(resolve, interval));
			if (this.stopped) break;
			status = await poll();
		}

		// Whatever the last poll said, the job may be done: walking the `next`
		// cursors is what puts pages in the shelf, and a lost status response is not
		// a lost crawl. Skip it only when the user cancelled or upstream failed.
		if (!this.stopped && (status === null || status.status === "completed")) {
			try {
				const documents = await readJobPages(client, kind, jobId, { maxPages: 20 });
				this.ingestDocuments(documents, seen);
			} catch {
				// The pages already painted stay valid; paging is best effort.
			}
		}
		if (!this.stopped && (status === null || status.status !== "cancelled")) {
			try {
				const errors = await client.jobErrors(kind, jobId);
				this.ingestErrors(errors);
			} catch {
				// Errors are diagnostics; never fail the run over them.
			}
		}

		this.watching = false;
		const duration = Date.now() - this.snapshot.startedAt;
		const outcome =
			this.stopped || status?.status === "cancelled" ? "stopped" : status?.status === "completed" ? "completed" : "failed";
		this.snapshot = {
			...this.snapshot,
			status: outcome,
			endedAt: Date.now(),
			creditsUsed: status?.creditsUsed ?? this.snapshot.creditsUsed,
			expiresAt: status?.expiresAt ?? this.snapshot.expiresAt,
			counts: { ...this.snapshot.counts, fetching: 0 },
			// A status we never got is itself the explanation; keep it rather than
			// letting the run end with a blank error.
			lastError: status?.error ?? lastFailure ?? this.snapshot.lastError,
		};
		const pages = status ? `${status.completed}/${status.total}` : `${this.snapshot.counts.crawled}/${this.snapshot.counts.discovered}`;
		this.pushLine(
			outcome === "failed" ? "error" : "ok",
			`run end  ${status?.status ?? "unknown"}  pages=${pages}  ${formatDuration(duration)}` +
				`${status?.creditsUsed !== undefined ? `  credits=${status.creditsUsed}` : ""}`,
			"run",
		);
		this.emit();
		await this.persist();
	}

	/** Applies one status response: counters, nodes and newly arrived pages. */
	private apply(status: JobStatus, seen: Set<string>): void {
		if (this.stopped) return;
		const total = Math.max(0, status.total);
		const completed = Math.max(0, status.completed);
		this.snapshot = {
			...this.snapshot,
			counts: {
				...this.snapshot.counts,
				crawled: completed,
				queued: Math.max(0, total - completed),
				fetching: status.status === "scraping" ? 1 : 0,
				discovered: Math.max(this.snapshot.counts.discovered, total),
			},
			creditsUsed: status.creditsUsed ?? this.snapshot.creditsUsed,
			expiresAt: status.expiresAt ?? this.snapshot.expiresAt,
		};
		this.ingestDocuments(status.data, seen);
	}

	private ingestDocuments(documents: readonly unknown[], seen: Set<string>): void {
		const target = this.snapshot.target;
		let pages = this.snapshot.pages.slice();
		let nodes = this.snapshot.nodes.slice();
		let elements = this.snapshot.elements;
		let bytes = this.snapshot.bytes;
		let chars = this.snapshot.chars;
		let artifacts = this.snapshot.artifacts.slice();
		let arrivals = this.snapshot.arrivals.slice();
		let budget = Math.max(0, MAX_DOCUMENT_CHARS - pages.reduce((sum, page) => sum + (page.markdown?.length ?? 0), 0));

		for (const raw of documents) {
			if (!raw || typeof raw !== "object") continue;
			const document = raw as Record<string, unknown>;
			const url = typeof document.url === "string" ? document.url : "";
			if (!url || seen.has(url)) continue;
			seen.add(url);

			const markdown = typeof document.markdown === "string" ? document.markdown : "";
			const profile = profileDocument(document);
			const keep = Math.min(MAX_PAGE_DOCUMENT_CHARS, budget);
			const preview = markdown.slice(0, keep);
			budget -= preview.length;
			const depth = pathDepth(url, target);
			const parentId = depth > 0 && target ? this.parentOf(url, depth, nodes, target) : null;
			const statusCode = typeof document.metadata === "object" && document.metadata
				? Number((document.metadata as Record<string, unknown>).statusCode ?? 200)
				: 200;

			pages.push({
				url,
				title: typeof document.title === "string" ? document.title : typeof document.metadata === "object" && document.metadata
					? String((document.metadata as Record<string, unknown>).title ?? "")
					: "",
				chars: markdown.length,
				depth,
				status: Number.isFinite(statusCode) ? statusCode : 200,
				linkCount: Array.isArray(document.links) ? document.links.length : undefined,
				bytes: markdown.length,
				...(preview.length > 0 ? { markdown: preview } : {}),
				elements: profile,
			});
			if (pages.length > MAX_PAGES) pages = pages.slice(-MAX_PAGES);

			bytes += markdown.length;
			chars += markdown.length;
			elements = addProfile(elements, profile);

			const title = typeof document.title === "string" ? document.title : "";
			const produced = pageArtifacts(document as FirecrawlDocument, {
				source: url,
				title: title || urlLabel(url),
				elements: profile,
				at: Date.now(),
			});
			if (produced.length > 0) {
				artifacts = [...artifacts, ...produced].slice(-MAX_ARTIFACTS);
				arrivals = [...arrivals, { url, kinds: produced.map((artifact) => artifact.kind), at: Date.now() }].slice(-MAX_ARRIVALS);
			}

			if (nodes.length < MAX_NODES) {
				nodes = [
					...nodes,
					{
						id: url,
						url,
						label: urlLabel(url),
						depth,
						parentId,
						state: "crawled",
						title: typeof document.title === "string" ? document.title : undefined,
						chars: markdown.length,
						durationMs: 0,
						elements: profile,
					},
				];
			} else {
				this.nodesTruncated = true;
			}

			this.pushLine(
				"ok",
				`GET  ${pathOf(url)}  ${formatBytes(markdown.length)}  chars=${formatCount(markdown.length)}`,
				"get",
			);
		}

		this.snapshot = { ...this.snapshot, pages, nodes, elements, bytes, chars, artifacts, arrivals };
		this.emit();
	}

	/** Shelf for work that is not a crawl (a parsed upload): one artifact, no run. */
	recordArtifact(artifact: CrawlArtifact | null): void {
		if (!artifact) return;
		this.snapshot = { ...this.snapshot, artifacts: [...this.snapshot.artifacts, artifact].slice(-MAX_ARTIFACTS) };
		this.emit();
	}

	/** Reads the archive index once, at activation. */
	async loadHistory(): Promise<void> {
		if (!this.archive) return;
		try {
			const history = await this.archive.list();
			this.snapshot = { ...this.snapshot, history };
			this.emit();
		} catch (error) {
			this.report("history", error);
		}
	}

	/**
	 * Re-opens a finished run from storage. The panel then behaves like it does
	 * after a crawl ends: everything readable, nothing polling.
	 */
	async restore(id: string): Promise<boolean> {
		if (!this.archive) return false;
		try {
			const run = await this.archive.read(id);
			if (!run) return false;
			this.stopped = true;
			this.watching = false;
			const total = run.counts.crawled + run.counts.denied + run.counts.failed;
			this.snapshot = {
				...emptySnapshot(),
				history: this.snapshot.history,
				runId: run.id,
				status: run.status,
				target: run.target,
				targetSource: "manual",
				startedAt: run.startedAt,
				endedAt: run.endedAt,
				counts: { crawled: run.counts.crawled, fetching: 0, queued: 0, denied: run.counts.denied, failed: run.counts.failed, discovered: total },
				creditsUsed: run.creditsUsed,
				artifacts: run.artifacts,
				archived: true,
			};
			this.pushLine("info", `restore  ${run.target}  pages=${run.counts.crawled}  artifacts=${run.artifacts.length}`, "run");
			this.emit();
			return true;
		} catch (error) {
			this.report("restore", error);
			return false;
		}
	}

	async removeArchived(id: string): Promise<void> {
		if (!this.archive) return;
		try {
			const history = await this.archive.remove(id);
			const cleared = this.snapshot.archived && this.snapshot.runId === id;
			this.snapshot = cleared ? { ...emptySnapshot(), history } : { ...this.snapshot, history };
			this.emit();
		} catch (error) {
			this.report("delete", error);
		}
	}

	private async persist(): Promise<void> {
		const runId = this.snapshot.runId;
		if (!this.archive || this.snapshot.archived || !runId) return;
		const { artifacts, pages } = this.snapshot;
		if (artifacts.length === 0 && pages.length === 0) return;
		try {
			const history = await this.archive.write({
				version: 1,
				id: runId,
				target: this.snapshot.target,
				status:
					this.snapshot.status === "failed" ? "failed" : this.snapshot.status === "stopped" ? "stopped" : "completed",
				startedAt: this.snapshot.startedAt,
				endedAt: this.snapshot.endedAt ?? Date.now(),
				counts: {
					crawled: this.snapshot.counts.crawled,
					denied: this.snapshot.counts.denied,
					failed: this.snapshot.counts.failed,
				},
				creditsUsed: this.snapshot.creditsUsed ?? 0,
				artifacts,
			});
			this.snapshot = { ...this.snapshot, history };
			this.pushLine("info", `saved  ${runId}  artifacts=${artifacts.length}`, "run");
			this.emit();
		} catch (error) {
			this.report("save", error);
		}
	}

	/** Logs, then surfaces through the host only when a context exists (unit tests have none). */
	private report(what: string, error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`[firecrawl] console ${what} failed`, error);
		if (hasPluginContext()) getPluginContext().ui.notify({ message, error: true });
	}

	private ingestErrors(
		errors: ReadonlyArray<{ url?: string; error?: string; code?: string; statusCode?: number; robots?: boolean }>,
	): void {
		if (errors.length === 0) return;
		const nodes = this.snapshot.nodes.slice();
		const denialsByCode = { ...this.snapshot.denialsByCode };
		let denied = this.snapshot.counts.denied;
		let failed = this.snapshot.counts.failed;

		for (const entry of errors) {
			const url = entry.url ?? "";
			// A link to another site's homepage is skipped on purpose, not failed;
			// counting it as a failure turns a normal crawl into a wall of red.
			if (/external_link/i.test(entry.code ?? "")) {
				this.pushLine("info", `skip  ${url || "(unknown)"}  external link`, "note");
				continue;
			}
			const message = entry.robots
				? "blocked by robots.txt"
				: entry.error ?? entry.code ?? `HTTP ${entry.statusCode ?? "?"}`;
			const isDenial = entry.robots === true || /robots|denied|forbidden|blocked/i.test(`${entry.code ?? ""} ${message}`);
			failed += isDenial ? 0 : 1;
			denied += isDenial ? 1 : 0;
			if (isDenial && entry.code) denialsByCode[entry.code] = (denialsByCode[entry.code] ?? 0) + 1;
			if (url && nodes.length < MAX_NODES) {
				nodes.push({
					id: url,
					url,
					label: urlLabel(url),
					depth: pathDepth(url, this.snapshot.target),
					parentId: this.snapshot.target || null,
					state: isDenial ? "denied" : "failed",
					code: entry.code,
				});
			}
			this.pushLine(
				isDenial ? "deny" : "error",
				`${isDenial ? "deny" : "fail"}  ${url || "(unknown)"}  ${truncate(message, 130)}`,
				isDenial ? "deny" : "fail",
			);
		}

		this.snapshot = {
			...this.snapshot,
			nodes,
			denialsByCode,
			counts: {
				...this.snapshot.counts,
				denied,
				failed,
				discovered: Math.max(this.snapshot.counts.discovered, this.snapshot.counts.crawled + denied + failed),
			},
			lastError: errors[0]?.error ?? this.snapshot.lastError,
		};
		this.emit();
	}

	private parentOf(url: string, depth: number, nodes: readonly CrawlNodeView[], target: string): string {
		const prefix = url.replace(/\/[^/]*$/, "/");
		const match = nodes.find((node) => node.depth === depth - 1 && prefix.startsWith(node.url.replace(/\/$/, "")));
		return match?.url ?? target;
	}

	private pushLine(level: ConsoleLevel, text: string, kind: ConsoleKind): void {
		this.lineId += 1;
		const line: ConsoleLine = { id: this.lineId, at: Date.now(), level, kind, text };
		this.snapshot = { ...this.snapshot, lines: [...this.snapshot.lines, line].slice(-MAX_LINES) };
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
}

function pathOf(url: string): string {
	try {
		return new URL(url).pathname.slice(0, 80);
	} catch {
		return url.slice(0, 80);
	}
}
