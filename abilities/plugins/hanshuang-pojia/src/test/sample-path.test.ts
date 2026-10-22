import { describe, expect, it } from "vitest";
import { isOutsideProject } from "../domain/sample-path";

describe("isOutsideProject", () => {
	it("accepts paths inside the open project", () => {
		expect(isOutsideProject("/work/demo.apk", "/work")).toBe(false);
		expect(isOutsideProject("/work/build/app-release.apk", "/work")).toBe(false);
		expect(isOutsideProject("/work", "/work")).toBe(false);
		expect(isOutsideProject("demo.apk", "/work")).toBe(false);
		expect(isOutsideProject("./build/../demo.apk", "/work")).toBe(false);
	});

	it("rejects absolute paths outside the project", () => {
		expect(isOutsideProject("/Users/me/.astravia/image-cache/a.png", "/work")).toBe(true);
		expect(isOutsideProject("/outside.apk", "/work")).toBe(true);
		// 前缀相同但不是子目录
		expect(isOutsideProject("/workshop/demo.apk", "/work")).toBe(true);
	});

	it("treats every home-relative path as outside", () => {
		expect(isOutsideProject("~/samples/demo.apk", "/work")).toBe(true);
		expect(isOutsideProject("~", "/work")).toBe(true);
	});

	it("folds separators and dot segments before comparing", () => {
		expect(isOutsideProject("/work/./build//../demo.apk", "/work/")).toBe(false);
		expect(isOutsideProject("/work/../etc/passwd", "/work")).toBe(true);
	});

	it("compares Windows drive paths without case", () => {
		expect(isOutsideProject("C:\\Work\\Build\\a.apk", "C:\\work")).toBe(false);
		expect(isOutsideProject("D:\\samples\\a.apk", "C:\\work")).toBe(true);
	});

	it("refuses to vouch for an absolute path when no workspace is attached", () => {
		// Nothing to compare against, and the command channel skips the host's root check, so an
		// absolute path is not treated as reachable. `scopeForSample` is the lenient layer.
		expect(isOutsideProject("/Users/me/a.apk", null)).toBe(true);
		expect(isOutsideProject("a.apk", null)).toBe(false);
	});
});
