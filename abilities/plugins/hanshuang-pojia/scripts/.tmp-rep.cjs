// 一次性：报告页 —— 顶部按钮统一（复制/导出/清理），工作区报告卡限高，避免把样本区挤走。
const fs = require("node:fs");
const p = "src/features/workbench/components/pages/reports.tsx";
let t = fs.readFileSync(p, "utf8");

// 1) 顶部按钮组：复制 / 导出 / 清理（清理只清当前报告缓存，不动 reports/ 文件）
const anchor = "\t\t\t\t\t</>\n\t\t\t\t}\n\t\t\t/>";
if (!t.includes("reports.clearCurrent")) {
	t = t.replace(
		anchor,
		[
			"\t\t\t\t\t\t<button",
			"\t\t\t\t\t\t\ttype=\"button\"",
			"\t\t\t\t\t\t\tonClick={() => model.clearReport()}",,
			"\t\t\t\t\t\t\tdisabled={!hasReport}",
			"\t\t\t\t\t\t\tclassName=\"flex items-center gap-1 rounded-md border border-line-subtle px-2 py-1 text-[11px] text-text-2 transition-colors hover:bg-surface-hover hover:text-risk-high disabled:opacity-40\"",
			"\t\t\t\t\t\t>",
			"\t\t\t\t\t\t\t<Icon name=\"close\" className=\"size-3\" />",
			"\t\t\t\t\t\t\t{t(\"reports.clearCurrent\")}",
			"\t\t\t\t\t\t</button>",
			"\t\t\t\t\t</>",
			"\t\t\t\t}",
			"\t\t\t/>",
		].join("\n"),
	);
}

// 2) 工作区报告卡：限高 + 自己滚，避免卡片高度抢走样本区
t = t.replace(
	'\t\t\t\t\t<div className="fb-scroll max-h-[220px] divide-y divide-line-subtle overflow-y-auto">',
	'\t\t\t\t\t<div className="fb-scroll max-h-[180px] divide-y divide-line-subtle overflow-y-auto">',
);

fs.writeFileSync(p, t);
console.log("clear button:", t.includes("reports.clearCurrent"), "| capped list:", t.includes("max-h-[180px]"));
