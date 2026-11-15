/**
 * 把上游的技能库**复制进插件**（Apache-2.0），从此不再运行时扫描上游。
 *
 * 用户要求：技能这块要完整参考上游实现到插件中供宿主使用，且**不能去扫上游**，因为插件是
 * 参考上游自研的——对上游安装位置的依赖会让"插件能不能用"取决于另一套 Python 环境是否装好。
 *
 * 目标布局（与宿主技能发现互不干扰）：
 *   agent/skills/<name>/SKILL.md         ← 9 个宿主可见入口技能（手写，不由本脚本同步）
 *   agent/skills/library/<category>/*.md ← 上游 11 类的完整技术库（本脚本同步，共 76 篇）
 *
 * 宿主的技能加载器只认文件名恰为 SKILL.md 的文件（resources/skills/discovery.ts:201），
 * 所以 library/ 下这些.md 不会被列成技能条目，只能通过 strix_load_skills 按需读取。
 */

const fs = require("node:fs");
const path = require("node:path");

// 路径跟着脚本走：写死盘符的脚本换一台机器就抛 ENOENT，而它恰恰是"升级上游技能库"用的。
const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");
const DEST = path.join(PLUGIN_ROOT, "agent/skills/library");
// 上游 checkout 允许用环境变量指到别处（CI、别人的机器）；默认就是本机这份。
const UPSTREAM_ROOT = process.env.STRIX_UPSTREAM_ROOT || "D:/open-source-projects/strix";
const SRC = path.join(UPSTREAM_ROOT, "strix/skills");
const LICENSE_SRC = path.join(UPSTREAM_ROOT, "LICENSE");

const SKIP = new Set(["__pycache__"]);
const ENTRY = new Set([
	"api-security-testing",
	"application-security-testing",
	"ci-security-scanning-with-strix",
	"find-security-vulnerabilities-in-code",
	"fix-security-vulnerabilities-with-strix",
	"managed-pentesting-with-strix",
	"owasp-top-10-testing",
	"penetration-testing-with-strix",
	"web-app-penetration-testing",
]);

if (!fs.existsSync(SRC)) {
	console.error(`找不到上游技能库：${SRC}`);
	console.error("用 STRIX_UPSTREAM_ROOT=<上游 checkout> 指过去，或先 clone github.com/usestrix/strix。");
	process.exit(1);
}

let copied = 0;
const perCategory = {};

for (const entry of fs.readdirSync(SRC, { withFileTypes: true })) {
	if (!entry.isDirectory() || SKIP.has(entry.name) || ENTRY.has(entry.name)) continue;
	const category = entry.name;
	const files = fs.readdirSync(path.join(SRC, category)).filter((name) => name.endsWith(".md"));
	if (!files.length) continue;
	fs.mkdirSync(path.join(DEST, category), { recursive: true });
	for (const file of files) {
		fs.copyFileSync(path.join(SRC, category, file), path.join(DEST, category, file));
		copied += 1;
	}
	perCategory[category] = files.length;
}

for (const file of fs.readdirSync(SRC).filter((name) => name.endsWith(".md"))) {
	fs.copyFileSync(path.join(SRC, file), path.join(DEST, file));
	copied += 1;
}

// 出处与许可：复制别人的文本必须把 LICENSE 与来源一起带上。
if (fs.existsSync(LICENSE_SRC)) fs.copyFileSync(LICENSE_SRC, path.join(DEST, "LICENSE"));

const table = Object.entries(perCategory)
	.map(([category, count]) => `  ${category}: ${count}`)
	.join("\n");
fs.writeFileSync(
	path.join(DEST, "PROVENANCE.md"),
	`# 出处\n\n本目录是 [usestrix/strix](https://github.com/usestrix/strix) 技能库的**逐字副本**，用于让本插件在没有安装上游 Python 包时也能完整加载技术知识。\n\n- 来源：\`strix/skills/\`（Apache License 2.0，见同目录 \`LICENSE\`）\n- 复制时间：${new Date().toISOString().slice(0, 10)}\n- 分类与篇数：\n${table}\n- 未复制：9 个已在 \`agent/skills/<name>/SKILL.md\` 里作为宿主入口技能的那一批\n\n**同步方式**：上游升级技能库时重跑 \`node scripts/dev/vendor-skills.cjs\`，不要手改这里的正文——手改会在下一次同步时丢失，也让「与上游一致」这句话失效。\n`,
);

let total = 0;
const walk = (dir) => {
	for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
		if (item.isDirectory()) walk(path.join(dir, item.name));
		else if (item.name.endsWith(".md")) total += 1;
	}
};
walk(DEST);

console.log(`copied ${copied} files`);
console.log(table);
console.log(`library md total: ${total}`);
