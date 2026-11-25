// @vitest-environment happy-dom

/**
 * 版本面板：列的是设计包的版本，不是生成过的图片。
 *
 * 真实缺陷：历史面板读的是 history-store（每条生成记录一张图），而磁盘上的事是
 * 「一个 `.logocreator-design/` 包里若干代版本」。两者对不上：删/改名后列表还是旧的，
 * 也看不出「这是同一份设计的第几代」。
 *
 * 契约：
 *   1. 按包分组，版本倒序（新的在上）；
 *   2. 点某一版把该包 + 版本交出去（画布据此复现几何）；
 *   3. 矢量版本能用 seed/style 还原成 spec，引擎是纯函数。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeSpec } from "../domain/spec";
import { specForVersion, type DesignPackageRef } from "../domain/design-versions";
import { VersionsSheet } from "../features/canvas/components/versions-sheet";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const pkg: DesignPackageRef = {
	folder: "acme.logocreator-design",
	slug: "acme",
	brand: "Acme",
	spec: normalizeSpec({ brandName: "Acme", style: "minimal", type: "icon-name", seed: 7 }),
	updatedAt: new Date(Date.now() - 60_000).toISOString(),
	versions: [
		{ index: 3, file: "variants/3.svg", subject: "leaf", seed: 9, style: "geometric", engine: "local", at: null },
		{ index: 2, file: "variants/2.svg", subject: "leaf", seed: 8, style: "minimal", engine: "local", at: null },
	],
};

// 面板打开时会去读磁盘；这里给它一个「没有包」的 fs，再用 packages 覆盖不现实，
// 所以直接测纯函数与分组渲染的那一半。
vi.mock("../domain/design-versions", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../domain/design-versions")>();
	return {
		...actual,
		listDesignVersions: async () => [pkg],
	};
});

const fsStub = {} as never;

afterEach(cleanup);

describe("the versions sheet", () => {
	it("groups versions under their package", async () => {
		render(
			<VersionsSheet open fs={fsStub} cwd="C:/repo" locale="en" onClose={() => {}} onOpen={() => {}} t={(key) => key} />,
		);
		// 只展开最近改过的那份，于是能看到它的版本行。
		expect(await screen.findByText("Acme")).toBeTruthy();
		expect(screen.getAllByText(/variants\/|geometric|minimal/).length).toBeGreaterThan(0);
	});

	it("hands the package and the version out when one is clicked", async () => {
		const onOpen = vi.fn();
		render(
			<VersionsSheet open fs={fsStub} cwd="C:/repo" locale="en" onClose={() => {}} onOpen={onOpen} t={(key) => key} />,
		);
		await screen.findByText("Acme");
		fireEvent.click(screen.getByText(/geometric/));
		expect(onOpen).toHaveBeenCalledWith(pkg, pkg.versions[0]);
	});

	it("rebuilds the spec of a version from its seed and style", () => {
		// 引擎是纯函数：同一 seed + style 必然渲染出同一份几何，所以版本可复现。
		const spec = specForVersion(pkg, pkg.versions[0]!);
		expect(spec.seed).toBe(9);
		expect(spec.style).toBe("geometric");
		expect(spec.brandName).toBe("Acme");
	});
});
