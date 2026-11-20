// 全侧栏审计 v2：字号/间距/图标按钮/副作用 的分布直方图 + 可疑点。
const fs = require("node:fs");
const path = require("node:path");

const root = "src/features/workbench";
const files = [];
(function walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full);
		else if (/\.tsx?$/.test(entry.name)) files.push(full);
	}
})(root);

const hist = new Map();
const raw = { font: [], gap: [], pad: [] };
const suspicious = { iconButton: [], effectModel: [], renderFind: [], rawColor: [] };

for (const file of files) {
	const source = fs.readFileSync(file, "utf8");
	const lines = source.split(/\r?\n/);

	// 字号直方图
	for (const m of source.matchAll(/text-\[([\d.]+)px\]/g)) {
		const key = m[1];
		hist.set(`text-${key}`, (hist.get(`text-${key}`) ?? 0) + 1);
		raw.font.push(`${file} ${key}`);
	}
	// gap / padding 直方图（只统计数字档）
	for (const m of source.matchAll(/\bgap-(?:x-|y-)?(\d+(?:\.\d+)?|\[[^\]]+\])/g)) hist.set(`gap-${m[1]}`, (hist.get(`gap-${m[1]}`) ?? 0) + 1);
	for (const m of source.matchAll(/\b(?:p|px|py|ps|pe|pt|pb)-(\d+(?:\.\d+)?|\[[^\]]+\])/g)) hist.set(`p*-${m[1]}`, (hist.get(`p*-${m[1]}`) ?? 0) + 1);

	lines.forEach((line, index) => {
		// 图标按钮：<button ...> 内含 <Icon 且同块没有 aria-label / title
		if (/<button[\s\S]*?<Icon/.test(line) && !/aria-label=|title=/.test(line)) {
			suspicious.iconButton.push(`${file}:${index + 1}  ${line.trim().slice(0, 110)}`);
		}
		if (/\}, \[[^\]]*\bmodel\b[^\]]*\]\);/.test(line) && !/model\.activity\.entries/.test(line)) {
			suspicious.effectModel.push(`${file}:${index + 1}  ${line.trim().slice(0, 110)}`);
		}
		if (/className="[^"]*(?:#[0-9a-fA-F]{6}|rgba?\()/.test(line)) {
			suspicious.rawColor.push(`${file}:${index + 1}  ${line.trim().slice(0, 110)}`);
		}
	});
}

const top = (prefix) =>
	[...hist.entries()]
		.filter(([key]) => key.startsWith(prefix))
		.sort((a, b) => b[1] - a[1])
		.slice(0, 16)
		.map(([key, count]) => `${key}×${count}`)
		.join("  ");

console.log("字号分布：", top("text-"));
console.log("\n间距分布：", top("p*-"));
console.log("\ngap 分布：", top("gap-"));
for (const [id, items] of Object.entries(suspicious)) {
	console.log(`\n### ${id} (${items.length})`);
	for (const item of items.slice(0, 12)) console.log("   " + item);
}
