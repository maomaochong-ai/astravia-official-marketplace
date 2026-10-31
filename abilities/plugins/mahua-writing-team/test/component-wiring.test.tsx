// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import en from "../locales/en.json";
import zh from "../locales/zh.json";
import type { StudioRuntime } from "../src/plugin-context.js";
import { setStudioRuntime } from "../src/plugin-context.js";
import { Cover } from "../src/features/workbench/components/shell/Cover.js";
import { PhaseBadge } from "../src/features/workbench/components/shell/PhaseBadge.js";
import { StudioMasthead } from "../src/features/workbench/components/shell/StudioMasthead.js";
import { coverSeed } from "../src/features/workbench/workbench-model.js";

/**
 * 组件接线测试：这几件是用户第一眼看到的东西（报头、封面、相位徽章），
 * 拆掉它们在界面上的任何一段，这里都要红。译名从真实的 locales/*.json 里取，
 * 所以顺带证明这些键确实存在——缺键时 `t` 会返回 undefined，断言立刻失败。
 */

type Catalog = Record<string, string>;

function translator(catalog: Catalog) {
	const missing: string[] = [];
	const t = (key: string, params?: Record<string, string | number>): string => {
		const raw = catalog[key];
		if (raw === undefined) {
			missing.push(key);
			return key;
		}
		return params ? raw.replace(/\{\{(\w+)\}\}/g, (_, slot: string) => String(params[slot] ?? "")) : raw;
	};
	return { t, missing };
}

let missing: string[] = [];

function useCatalog(catalog: Catalog) {
	const { t, missing: gaps } = translator(catalog);
	missing = gaps;
	setStudioRuntime({ ctx: { i18n: { t } } } as unknown as StudioRuntime);
}

afterEach(() => {
	cleanup();
	setStudioRuntime(null);
	// 任何一次渲染都不许去取不存在的键。
	expect(missing).toEqual([]);
});

describe("studio masthead", () => {
	it("prints the four stops of one line: who writes, what landed, what was read", () => {
		useCatalog(en as Catalog);
		render(
			<StudioMasthead
				section="Shelf"
				sync={{
					writer: "Nie",
					doing: "chapter 41",
					file: "41.md",
					words: "3,180",
					ago: "2 min",
					queue: "2 queued",
				}}
			/>,
		);

		expect(screen.getByText("Mahua Novels")).toBeTruthy();
		expect(screen.getByText("Shelf")).toBeTruthy();
		expect(screen.getByText("Drafting")).toBeTruthy();
		expect(screen.getByText("chapter 41")).toBeTruthy();
		expect(screen.getByText("Landed")).toBeTruthy();
		expect(screen.getByText("41.md")).toBeTruthy();
		expect(screen.getByText("Read")).toBeTruthy();
		expect(screen.getByText("2 min")).toBeTruthy();
		expect(screen.getByText("2 queued")).toBeTruthy();
	});

	it("drops the middle line when there is nothing to report, and keeps the caller slot", () => {
		useCatalog(en as Catalog);
		render(<StudioMasthead section="Ledger" right={<button type="button">Full screen</button>} />);

		expect(screen.queryByText("Drafting")).toBeNull();
		expect(screen.getByText("Ledger")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Full screen" })).toBeTruthy();
	});

	it("speaks Chinese when the catalog is Chinese", () => {
		useCatalog(zh as Catalog);
		render(<StudioMasthead section="书架" sync={{ writer: "聂", doing: "第 41 章", file: "41.md", words: "3,180", ago: "2 分钟", queue: "2 待写" }} />);

		expect(screen.getByText("麻花小说网")).toBeTruthy();
		expect(screen.getByText("落盘")).toBeTruthy();
	});
});

describe("cover", () => {
	it("carries the cover glyph and hides the plate from screen readers", () => {
		useCatalog(en as Catalog);
		const { container } = render(<Cover {...coverSeed("山河故人")} size="shelf" />);

		expect(screen.getByText("山")).toBeTruthy();
		expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
	});

	it("prints no glyph at all when the book has no title, instead of inventing one", () => {
		expect(coverSeed("").mark).toBe("");
		expect(coverSeed("   ").mark).toBe("");
	});

	it("gives the same title the same plate and two different titles different plates", () => {
		expect(coverSeed("山河故人")).toEqual(coverSeed("山河故人"));
		expect(coverSeed("山河故人")).not.toEqual(coverSeed("长夜行"));
	});
});

describe("phase badge", () => {
	it("names the phase from the catalog rather than from the enum", () => {
		useCatalog(en as Catalog);
		render(<PhaseBadge phase="drafting" />);
		expect(screen.getByText("Draft")).toBeTruthy();
	});
});
