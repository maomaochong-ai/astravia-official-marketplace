import { describe, expect, it } from "vitest";
import type { DownloadTask } from "../domain/media-info";
import { isActive, phaseLabelKey, progressOf, sortTasks } from "../domain/task-state";

function task(overrides: Partial<DownloadTask>): DownloadTask {
  return {
    id: "t",
    url: "https://example.com/v",
    site: "youtube",
    title: "Example",
    streamId: "1",
    quality: "1080p",
    ext: "mp4",
    needsFfmpeg: true,
    totalBytes: 1000,
    receivedBytes: 0,
    speedBps: 0,
    etaSeconds: null,
    phase: "queued",
    createdAt: 0,
    startedAt: null,
    finishedAt: null,
    filePath: null,
    error: null,
    ...overrides,
  };
}

describe("progressOf", () => {
  it("clamps the overshoot the merge step causes", () => {
    // The merged output sits next to its parts, so the directory total briefly doubles.
    expect(progressOf(task({ receivedBytes: 1600 }))).toBe(1);
    expect(progressOf(task({ receivedBytes: 250 }))).toBe(0.25);
  });

  it("treats an unknown total as no progress rather than dividing by zero", () => {
    expect(progressOf(task({ totalBytes: 0, receivedBytes: 400 }))).toBe(0);
  });

  it("reports a finished task as complete regardless of bytes", () => {
    expect(progressOf(task({ phase: "completed", receivedBytes: 10, totalBytes: 1000 }))).toBe(1);
  });
});

describe("task state", () => {
  it("counts every pre-terminal phase as active", () => {
    for (const phase of ["queued", "extracting", "downloading", "merging", "moving"] as const) {
      expect(isActive(task({ phase }))).toBe(true);
    }
    for (const phase of ["completed", "failed", "canceled"] as const) {
      expect(isActive(task({ phase }))).toBe(false);
    }
  });

  it("maps every phase to a locale key", () => {
    expect(phaseLabelKey("merging")).toBe("task.phase.merging");
    expect(phaseLabelKey("canceled")).toBe("task.phase.canceled");
  });

  it("groups unfinished work first, newest on top inside each group", () => {
    const sorted = sortTasks([
      task({ id: "done-new", phase: "completed", createdAt: 9 }),
      task({ id: "run-old", phase: "downloading", createdAt: 1 }),
      task({ id: "run-new", phase: "queued", createdAt: 5 }),
      task({ id: "done-old", phase: "failed", createdAt: 2 }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["run-new", "run-old", "done-new", "done-old"]);
  });

  it("does not mutate the array it was given", () => {
    const input = [task({ id: "a", createdAt: 1 }), task({ id: "b", createdAt: 2 })];
    sortTasks(input);
    expect(input.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});
