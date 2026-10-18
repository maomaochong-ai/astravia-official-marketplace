import { describe, expect, it } from "vitest";
import type { CrawlArtifact } from "../src/domain/firecrawl/artifacts";
import {
	ARCHIVED_ITEMS,
	ARCHIVED_TEXT_CHARS,
	MAX_ARCHIVED_ARTIFACTS,
	MAX_ARCHIVED_RUNS,
	RunArchive,
	type ArchiveStorage,
	type ArchivedRun,
} from "../src/features/crawler-console/services/run-archive";

interface FakeStorage extends ArchiveStorage {
	files: Map<string, string>;
	removed: string[];
}

function memoryStorage(): FakeStorage {
	const files = new Map<string, string>();
	const removed: string[] = [];
	return {
		files,
		removed,
		async list(prefix) {
			const keys = [...files.keys()];
			return prefix ? keys.filter((path) => path.startsWith(prefix)) : keys;
		},
		async readFile(path) {
			return files.get(path) ?? null;
		},
		async writeFile(path, data) {
			files.set(path, data);
			return undefined;
		},
		async commit(changes) {
			for (const change of changes) {
				files.delete(change.path);
				removed.push(change.path);
			}
			return undefined;
		},
	};
}

function artifact(kind: CrawlArtifact["kind"], id: string, extra: Partial<CrawlArtifact> = {}): CrawlArtifact {
	return {
		id: `${kind}:${id}`,
		kind,
		source: `https://example.com/${id}`,
		title: id,
		bytes: 10,
		at: 1,
		...extra,
	};
}

function run(id: string, artifacts: CrawlArtifact[] = [artifact("markdown", id)]): ArchivedRun {
	return {
		version: 1,
		id,
		target: "https://example.com/",
		status: "completed",
		startedAt: 1_000,
		endedAt: 2_000,
		counts: { crawled: 3, denied: 1, failed: 0 },
		creditsUsed: 4,
		artifacts,
	};
}

describe("RunArchive", () => {
	it("saves a run and lists it by type", async () => {
		const archive = new RunArchive(memoryStorage());
		const runs = await archive.write(run("r1", [artifact("markdown", "a"), artifact("links", "b", { items: ["x"] })]));

		expect(runs).toHaveLength(1);
		expect(runs[0]!.artifacts).toBe(2);
		expect(runs[0]!.kinds).toEqual({ markdown: 1, links: 1 });
		expect(runs[0]!.counts.crawled).toBe(3);
	});

	it("reads a run back so its products can be re-consumed", async () => {
		const storage = memoryStorage();
		const archive = new RunArchive(storage);
		await archive.write(run("r1", [artifact("markdown", "a", { text: "# Saved" })]));

		const stored = await archive.read("r1");
		expect(stored?.artifacts[0]?.text).toBe("# Saved");
		expect(await archive.read("missing")).toBeNull();
	});

	it("keeps the newest runs and drops the files behind them", async () => {
		const storage = memoryStorage();
		const archive = new RunArchive(storage);

		for (let index = 0; index < MAX_ARCHIVED_RUNS + 1; index += 1) {
			await archive.write(run(`r${index}`));
		}

		const runs = await archive.list();
		expect(runs).toHaveLength(MAX_ARCHIVED_RUNS);
		expect(runs.map((entry) => entry.id)).not.toContain("r0");
		expect(storage.removed).toEqual(["runs/r0.json"]);
	});

	it("compacts what it keeps", async () => {
		const archive = new RunArchive(memoryStorage());
		const bulky = [
			artifact("markdown", "big", { text: "x".repeat(ARCHIVED_TEXT_CHARS + 1_000) }),
			artifact("links", "many", { items: Array.from({ length: ARCHIVED_ITEMS + 10 }, (_, index) => `l${index}`) }),
		];
		await archive.write(run("r1", bulky));

		const stored = await archive.read("r1");
		expect(stored?.artifacts[0]?.text).toHaveLength(ARCHIVED_TEXT_CHARS);
		expect(stored?.artifacts[1]?.items).toHaveLength(ARCHIVED_ITEMS);
	});

	it("drops the oldest artifacts once a run is too big", async () => {
		const archive = new RunArchive(memoryStorage());
		const artifacts = Array.from({ length: MAX_ARCHIVED_ARTIFACTS + 5 }, (_, index) => artifact("links", `p${index}`));
		await archive.write(run("r1", artifacts));

		const stored = await archive.read("r1");
		expect(stored?.artifacts).toHaveLength(MAX_ARCHIVED_ARTIFACTS);
		expect(stored?.artifacts[0]?.id).toBe("links:p5");
	});

	it("removes a run from the index and the disk", async () => {
		const storage = memoryStorage();
		const archive = new RunArchive(storage);
		await archive.write(run("r1"));
		await archive.write(run("r2"));

		const runs = await archive.remove("r1");
		expect(runs.map((entry) => entry.id)).toEqual(["r2"]);
		expect(storage.removed).toEqual(["runs/r1.json"]);
	});

	it("survives a corrupt index and an unreadable record", async () => {
		const storage = memoryStorage();
		storage.files.set("runs/index.json", "{ not json");
		storage.files.set("runs/bad.json", "{ not json");
		const archive = new RunArchive(storage);

		expect(await archive.list()).toEqual([]);
		expect(await archive.read("bad")).toBeNull();
	});

	it("repairs a record that lost its optional fields", async () => {
		const storage = memoryStorage();
		storage.files.set("runs/legacy.json", JSON.stringify({ id: "legacy", artifacts: [{ kind: "markdown" }] }));
		const archive = new RunArchive(storage);

		const stored = await archive.read("legacy");
		expect(stored?.status).toBe("completed");
		expect(stored?.counts.failed).toBe(0);
		expect(stored?.creditsUsed).toBe(0);
	});

	it("keeps ids filesystem safe", async () => {
		const storage = memoryStorage();
		const archive = new RunArchive(storage);
		await archive.write(run("../../escape"));

		const paths = [...storage.files.keys()];
		expect(paths.every((path) => path.startsWith("runs/") && !path.slice(5).includes("/"))).toBe(true);
		expect(await archive.list()).toHaveLength(1);
	});
});
