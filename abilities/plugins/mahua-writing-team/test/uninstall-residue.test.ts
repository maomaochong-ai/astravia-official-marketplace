import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 卸载残留审计。
 *
 * 宿主卸载插件时只做两件事：停用 activation（跑我们返回的 cleanup）、删掉插件存储目录。
 * 所以残留只可能来自三类地方，逐一钉住：
 *  1. **浏览器侧存储**（localStorage / sessionStorage）：宿主不清，插件卸载后还在。
 *  2. **登记而未释放**（工具、钩子、标签页、轮子卡）：停用后仍指向已销毁的组件。
 *  3. **写到插件存储之外**：那些文件属主是用户，卸载不会删——必须是用户显式发起的（导出到
 *     workspace），不能是插件的副作用。
 */

const root = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
		else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
	}
	return out;
}

const sources = sourceFiles(join(root, "src")).map((file) => ({
	path: relative(root, file).replace(/\\/g, "/"),
	text: readFileSync(file, "utf8"),
}));

describe("uninstall leaves nothing behind", () => {
	it("never touches browser storage — the host does not clear it", () => {
		const hits = sources.filter((file) => /localStorage|sessionStorage|indexedDB/.test(file.text));
		expect(hits.map((file) => file.path)).toEqual([]);
	});

	it("keeps every persisted byte inside plugin storage", () => {
		// ctx.fs 的写入只允许出现在「用户显式导出」那一条路上（workspace-tools）。
		const fsWriters = sources.filter((file) => /ctx\.fs\.writeFile|ctx\.fs\.createDirectory/.test(file.text));
		expect(fsWriters.map((file) => file.path).sort()).toEqual(["src/tools/workspace-tools.ts"]);
	});

	it("disposes every registration it made", () => {
		const index = readFileSync(join(root, "src", "index.tsx"), "utf8");
		// 四类登记：工具、轮次卡、标签页、钩子。每一个都必须出现在 cleanup 里。
		for (const marker of ["for (const disposable of tools) disposable.dispose();", "tab.dispose()", "turnCard.dispose()", "unhook.dispose()"]) {
			expect(index, marker).toContain(marker);
		}
	});

	it("keeps the disposable of every tool registration", () => {
		// 36 个工具都由 registerTool 登记；它的返回值曾经被整批丢掉，插件停用后仍然可调用、
		// 一调就抛错——那正是「卸载没卸干净」。现在由 registerNovelTools 记账并返回。
		const registry = readFileSync(join(root, "src", "tools", "register-novel-tools.ts"), "utf8");
		expect(registry).toContain("Disposable[]");
		expect(registry).toContain("owned.push(disposable)");
		expect(registry).toContain("return owned");
		// 记账必须包住所有工具文件：少挂一个，它那批工具就又变回残留。
		for (const marker of ["registerReadingTools", "registerFoundationTools", "registerOutlineTools", "registerChapterTools", "registerLedgerTools", "registerWorkspaceTools"]) {
			expect(registry, marker).toContain(marker);
		}
	});

	it("keeps deactivate() empty on purpose", () => {
		const index = readFileSync(join(root, "src", "index.tsx"), "utf8");
		// 宿主 reload 是「先激活新 activation、后停用旧的」：模块级 deactivate 在此刻触碰
		// 任何共享状态都会误杀新 activation。清理由 cleanup 逐 activation 负责。
		expect(index).toMatch(/deactivate\(\)\s*\{\s*\}/);
	});
});
