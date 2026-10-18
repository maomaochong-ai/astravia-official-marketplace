/**
 * Crawl products outlive the tab.
 *
 * The console snapshot is deliberately lossy — 400 log lines, a 24 k character
 * preview per page — and it dies with the webview. Artifacts are the part a user
 * comes back for: yesterday's link list, the Markdown of one page, the parse of a
 * PDF. So each finished run is written to plugin storage as one JSON file plus a
 * small index, and can be restored into the console later.
 *
 * The seam is a narrow storage interface rather than `PluginStorageApi` so tests
 * can drive it with a Map, and `commit` is optional because eviction is best
 * effort: a stale file is cheaper than a failed save.
 */

import {
	ARTIFACT_KINDS,
	type ArtifactKind,
	type CrawlArtifact,
	emptyTotals,
} from "../../../domain/firecrawl/artifacts";

export interface ArchiveStorage {
	list(prefix?: string): Promise<string[]>;
	readFile(path: string, encoding: "utf8" | "base64"): Promise<string | null>;
	writeFile(path: string, data: string, encoding: "utf8" | "base64"): Promise<unknown>;
	commit?(changes: Array<{ type: "remove"; path: string }>): Promise<unknown>;
}

export type ArchivedStatus = "completed" | "failed" | "stopped";

export interface ArchiveCounts {
	crawled: number;
	denied: number;
	failed: number;
}

export interface ArchivedRun {
	version: 1;
	id: string;
	target: string;
	status: ArchivedStatus;
	startedAt: number;
	endedAt: number;
	counts: ArchiveCounts;
	creditsUsed: number;
	artifacts: CrawlArtifact[];
}

export interface RunSummary {
	id: string;
	target: string;
	status: ArchivedStatus;
	startedAt: number;
	endedAt: number;
	counts: ArchiveCounts;
	creditsUsed: number;
	artifacts: number;
	bytes: number;
	kinds: Partial<Record<ArtifactKind, number>>;
}

const INDEX_FILE = "runs/index.json";
const RUN_DIR = "runs";
/** Newest first; older runs are dropped with their files. */
export const MAX_ARCHIVED_RUNS = 6;
export const MAX_ARCHIVED_ARTIFACTS = 260;
export const ARCHIVED_TEXT_CHARS = 2_400;
export const ARCHIVED_ITEMS = 40;

function runFile(id: string): string {
	return `${RUN_DIR}/${id}.json`;
}

function safeId(id: string): string {
	return id.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 64) || "run";
}

function number(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summarize(run: ArchivedRun): RunSummary {
	const totals = emptyTotals();
	for (const artifact of run.artifacts) {
		totals.total += 1;
		totals.byKind[artifact.kind] += 1;
		totals.bytes += artifact.bytes;
	}
	const kinds: Partial<Record<ArtifactKind, number>> = {};
	for (const kind of ARTIFACT_KINDS) {
		if (totals.byKind[kind] > 0) kinds[kind] = totals.byKind[kind];
	}
	return {
		id: run.id,
		target: run.target,
		status: run.status,
		startedAt: run.startedAt,
		endedAt: run.endedAt,
		counts: run.counts,
		creditsUsed: run.creditsUsed,
		artifacts: totals.total,
		bytes: totals.bytes,
		kinds,
	};
}

/** Trimmed copy: the shelf keeps the head of every artifact, not the whole page. */
function compact(artifact: CrawlArtifact): CrawlArtifact {
	const text = artifact.text && artifact.text.length > ARCHIVED_TEXT_CHARS ? artifact.text.slice(0, ARCHIVED_TEXT_CHARS) : artifact.text;
	const items = artifact.items && artifact.items.length > ARCHIVED_ITEMS ? artifact.items.slice(0, ARCHIVED_ITEMS) : artifact.items;
	return { ...artifact, ...(text ? { text } : {}), ...(items ? { items } : {}) };
}

function parseRun(raw: string | null): ArchivedRun | null {
	if (!raw) return null;
	try {
		const value = JSON.parse(raw) as Partial<ArchivedRun>;
		if (!value || typeof value.id !== "string" || !Array.isArray(value.artifacts)) return null;
		return {
			version: 1,
			id: value.id,
			target: typeof value.target === "string" ? value.target : "",
			status: value.status === "failed" || value.status === "stopped" ? value.status : "completed",
			startedAt: number(value.startedAt),
			endedAt: number(value.endedAt),
			counts: {
				crawled: number(value.counts?.crawled),
				denied: number(value.counts?.denied),
				failed: number(value.counts?.failed),
			},
			creditsUsed: number(value.creditsUsed),
			artifacts: value.artifacts.filter((entry): entry is CrawlArtifact => Boolean(entry) && typeof entry === "object"),
		};
	} catch {
		return null;
	}
}

export class RunArchive {
	constructor(private readonly storage: ArchiveStorage) {}

	/** Newest first. A corrupt index degrades to an empty shelf, never a crash. */
	async list(): Promise<RunSummary[]> {
		const raw = await this.storage.readFile(INDEX_FILE, "utf8");
		if (!raw) return [];
		try {
			const value = JSON.parse(raw) as { runs?: RunSummary[] };
			if (!Array.isArray(value.runs)) return [];
			return value.runs.filter((entry): entry is RunSummary => Boolean(entry) && typeof entry.id === "string");
		} catch {
			return [];
		}
	}

	async read(id: string): Promise<ArchivedRun | null> {
		return parseRun(await this.storage.readFile(runFile(safeId(id)), "utf8"));
	}

	/** Save one finished run and return the index as it now stands. */
	async write(run: ArchivedRun): Promise<RunSummary[]> {
		const id = safeId(run.id);
		const kept = run.artifacts.slice(-MAX_ARCHIVED_ARTIFACTS).map(compact);
		const record: ArchivedRun = { ...run, id, artifacts: kept };
		await this.storage.writeFile(runFile(id), JSON.stringify(record), "utf8");

		const existing = (await this.list()).filter((entry) => entry.id !== id);
		const runs = [summarize(record), ...existing].slice(0, MAX_ARCHIVED_RUNS);
		await this.storage.writeFile(INDEX_FILE, JSON.stringify({ version: 1, runs }), "utf8");

		const dropped = existing.filter((entry) => !runs.some((keptRun) => keptRun.id === entry.id)).map((entry) => entry.id);
		if (dropped.length > 0 && this.storage.commit) {
			try {
				await this.storage.commit(dropped.map((droppedId) => ({ type: "remove" as const, path: runFile(droppedId) })));
			} catch {
				// A leftover file is invisible: the index is the source of truth.
			}
		}
		return runs;
	}

	async remove(id: string): Promise<RunSummary[]> {
		const runId = safeId(id);
		const runs = (await this.list()).filter((entry) => entry.id !== runId);
		await this.storage.writeFile(INDEX_FILE, JSON.stringify({ version: 1, runs }), "utf8");
		if (this.storage.commit) {
			try {
				await this.storage.commit([{ type: "remove", path: runFile(runId) }]);
			} catch {
				// Same as above: the index already forgot it.
			}
		}
		return runs;
	}
}
